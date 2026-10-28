package net.dabzse.omnigit

import com.intellij.openapi.project.Project
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.Executors

/**
 * Handles JSON message passing between the JCEF webview UI and the host git operations.
 */
class GitBridge(private val project: Project) {
    private val executor = Executors.newSingleThreadExecutor()

    fun handleMessage(jsonMessage: String, callback: (String) -> Unit) {
        executor.submit {
            try {
                val basePath = project.basePath ?: return@submit

                when {
                    jsonMessage.contains("\"requestCommits\"") -> {
                        val format = "%H\u001e%h\u001e%P\u001e%s\u001e%an\u001e%ae\u001e%at\u001e%d"
                        val logOutput = executeGit(basePath, "log", "--date-order", "--format=$format", "-n", "300", "--all")
                        val commitsJson = parseCommitsOutput(logOutput)
                        callback("""{"type":"commits","data":$commitsJson,"__fromHost":true}""")
                    }
                    jsonMessage.contains("\"requestStatus\"") -> {
                        val branch = executeGit(basePath, "rev-parse", "--abbrev-ref", "HEAD").trim()
                        val response = """{"type":"status","data":{"currentBranch":"$branch","detachedHead":false,"ahead":0,"behind":0,"staged":[],"unstaged":[],"untracked":[],"conflicts":[],"merging":false,"rebasing":false,"cherryPicking":false},"__fromHost":true}"""
                        callback(response)
                    }
                    jsonMessage.contains("\"requestBranches\"") -> {
                        val branchesOutput = executeGit(basePath, "branch", "-a", "--format=%(refname:short)|%(HEAD)")
                        val lines = branchesOutput.lines().filter { it.isNotBlank() }
                        val branchItems = lines.joinToString(",") { line ->
                            val parts = line.split("|")
                            val name = escapeJson(parts.getOrNull(0)?.trim() ?: "")
                            val isHead = parts.getOrNull(1)?.trim() == "*"
                            val isRemote = name.startsWith("origin/") || name.startsWith("remotes/")
                            """{"name":"$name","isRemote":$isRemote,"isCurrent":$isHead,"hash":"","lastCommitDate":0,"lastCommitSubject":""}"""
                        }
                        callback("""{"type":"branches","data":[$branchItems],"__fromHost":true}""")
                    }
                    jsonMessage.contains("\"requestTags\"") -> {
                        val tagsOutput = executeGit(basePath, "tag", "-l", "--format=%(refname:short)|%(objectname:short)")
                        val lines = tagsOutput.lines().filter { it.isNotBlank() }
                        val tagItems = lines.joinToString(",") { line ->
                            val parts = line.split("|")
                            val name = escapeJson(parts.getOrNull(0)?.trim() ?: "")
                            val hash = escapeJson(parts.getOrNull(1)?.trim() ?: "")
                            """{"name":"$name","hash":"$hash"}"""
                        }
                        callback("""{"type":"tags","data":[$tagItems],"__fromHost":true}""")
                    }
                    jsonMessage.contains("\"requestStashes\"") -> {
                        val stashOutput = executeGit(basePath, "stash", "list", "--format=%gd|%gs|%at")
                        val lines = stashOutput.lines().filter { it.isNotBlank() }
                        val stashItems = lines.mapIndexed { idx, line ->
                            val parts = line.split("|")
                            val msg = escapeJson(parts.getOrNull(1)?.trim() ?: "")
                            val date = parts.getOrNull(2)?.trim()?.toLongOrNull() ?: 0L
                            """{"index":$idx,"hash":"","message":"$msg","date":$date,"branch":""}"""
                        }.joinToString(",")
                        callback("""{"type":"stashes","data":[$stashItems],"__fromHost":true}""")
                    }
                    jsonMessage.contains("\"checkoutBranch\"") -> {
                        val branchName = extractStringProp(jsonMessage, "name")
                        if (branchName.isNotBlank()) {
                            executeGit(basePath, "checkout", branchName)
                            handleMessage("""{"type":"requestStatus"}""", callback)
                            handleMessage("""{"type":"requestCommits"}""", callback)
                        }
                    }
                    jsonMessage.contains("\"createBranch\"") -> {
                        val branchName = extractStringProp(jsonMessage, "name")
                        val startPoint = extractStringProp(jsonMessage, "startPoint")
                        if (branchName.isNotBlank()) {
                            if (startPoint.isNotBlank()) {
                                executeGit(basePath, "branch", branchName, startPoint)
                            } else {
                                executeGit(basePath, "branch", branchName)
                            }
                            handleMessage("""{"type":"requestBranches"}""", callback)
                        }
                    }
                    jsonMessage.contains("\"deleteBranch\"") -> {
                        val branchName = extractStringProp(jsonMessage, "name")
                        if (branchName.isNotBlank()) {
                            executeGit(basePath, "branch", "-D", branchName)
                            handleMessage("""{"type":"requestBranches"}""", callback)
                        }
                    }
                    jsonMessage.contains("\"cherryPick\"") -> {
                        val hash = extractStringProp(jsonMessage, "hash")
                        if (hash.isNotBlank()) {
                            executeGit(basePath, "cherry-pick", hash)
                            handleMessage("""{"type":"requestCommits"}""", callback)
                        }
                    }
                    jsonMessage.contains("\"revert\"") -> {
                        val hash = extractStringProp(jsonMessage, "hash")
                        if (hash.isNotBlank()) {
                            executeGit(basePath, "revert", "--no-edit", hash)
                            handleMessage("""{"type":"requestCommits"}""", callback)
                        }
                    }
                }
            } catch (e: Exception) {
                callback("""{"type":"error","data":{"message":"${escapeJson(e.message ?: "Unknown error")}"},"__fromHost":true}""")
            }
        }
    }

    private fun parseCommitsOutput(output: String): String {
        val lines = output.lines().filter { it.isNotBlank() }
        val commitObjects = lines.mapNotNull { line ->
            val parts = line.split("\u001e")
            if (parts.size < 7) return@mapNotNull null

            val hash = parts[0].trim()
            val shortHash = parts[1].trim()
            val parents = parts[2].trim().split(" ").filter { it.isNotBlank() }.map { "\"$it\"" }
            val subject = escapeJson(parts[3].trim())
            val authorName = escapeJson(parts[4].trim())
            val authorEmail = escapeJson(parts[5].trim())
            val authorDate = parts[6].trim().toLongOrNull() ?: 0L
            val refsRaw = parts.getOrNull(7)?.trim() ?: ""

            val refsList = parseDecorations(refsRaw)

            """{"hash":"$hash","shortHash":"$shortHash","parents":[${parents.joinToString(",")}],"subject":"$subject","body":"","author":{"name":"$authorName","email":"$authorEmail"},"authorDate":$authorDate,"committer":{"name":"$authorName","email":"$authorEmail"},"commitDate":$authorDate,"refs":[$refsList]}"""
        }
        return "[${commitObjects.joinToString(",")}]"
    }

    private fun parseDecorations(raw: String): String {
        val cleaned = raw.removePrefix("(").removeSuffix(")").trim()
        if (cleaned.isBlank()) return ""
        val refs = cleaned.split(",").map { it.trim() }.filter { it.isNotBlank() }
        return refs.joinToString(",") { ref ->
            val isHead = ref.startsWith("HEAD -> ")
            val name = escapeJson(ref.removePrefix("HEAD -> ").removePrefix("tag: ").trim())
            val type = when {
                ref.startsWith("HEAD -> ") -> "head"
                ref.startsWith("tag: ") -> "tag"
                name.contains("/") -> "remote"
                else -> "head"
            }
            """{"name":"$name","type":"$type","isHead":$isHead}"""
        }
    }

    private fun extractStringProp(json: String, prop: String): String {
        val pattern = "\"$prop\"\\s*:\\s*\"([^\"]+)\"".toRegex()
        return pattern.find(json)?.groupValues?.getOrNull(1) ?: ""
    }

    private fun escapeJson(str: String): String {
        return str.replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\b", "\\b")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
    }

    private fun executeGit(workingDir: String, vararg args: String): String {
        val command = mutableListOf("git")
        command.addAll(args)
        val process = ProcessBuilder(command)
            .directory(java.io.File(workingDir))
            .redirectErrorStream(true)
            .start()

        val output = StringBuilder()
        BufferedReader(InputStreamReader(process.inputStream)).use { reader ->
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                output.append(line).append("\n")
            }
        }
        process.waitFor()
        return output.toString()
    }
}

