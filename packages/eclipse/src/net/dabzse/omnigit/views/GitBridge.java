package net.dabzse.omnigit.views;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;

/**
 * JS-to-Java bridge for Eclipse SWT Browser executing Git operations.
 */
public class GitBridge {
    private static final String HOST_SUFFIX = ",\"__fromHost\":true}";
    private static final String GIT_BRANCH_CMD = "branch";
    private static final String JSON_NAME_PREFIX = "{\"name\":\"";
    private static final String HEAD_PREFIX = "HEAD -> ";
    private static final String TAG_PREFIX = "tag: ";

    public String handleMessage(String jsonMessage) {
        try {
            if (jsonMessage.contains("\"requestCommits\"")) {
                return handleRequestCommits();
            }
            if (jsonMessage.contains("\"requestStatus\"")) {
                return handleRequestStatus();
            }
            if (jsonMessage.contains("\"requestBranches\"")) {
                return handleRequestBranches();
            }
            if (jsonMessage.contains("\"requestTags\"")) {
                return handleRequestTags();
            }
            if (jsonMessage.contains("\"checkoutBranch\"")) {
                return handleCheckoutBranch(jsonMessage);
            }
            if (jsonMessage.contains("\"createBranch\"")) {
                return handleCreateBranch(jsonMessage);
            }
            if (jsonMessage.contains("\"deleteBranch\"")) {
                return handleDeleteBranch(jsonMessage);
            }
        } catch (IOException e) {
            return buildErrorJson(e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return buildErrorJson("Git execution interrupted: " + e.getMessage());
        }
        return null;
    }

    private String buildErrorJson(String message) {
        String safeMsg = message != null ? message : "Unknown error";
        return "{\"type\":\"error\",\"data\":{\"message\":\"" + escapeJson(safeMsg) + "\"}" + HOST_SUFFIX;
    }

    private String handleRequestCommits() throws IOException, InterruptedException {
        String format = "%H\u001e%h\u001e%P\u001e%s\u001e%an\u001e%ae\u001e%at\u001e%d";
        String logOutput = executeGit("log", "--date-order", "--format=" + format, "-n", "300", "--all");
        String commitsJson = parseCommitsOutput(logOutput);
        return "{\"type\":\"commits\",\"data\":" + commitsJson + HOST_SUFFIX;
    }

    private String handleRequestStatus() throws IOException, InterruptedException {
        String branch = executeGit("rev-parse", "--abbrev-ref", "HEAD").trim();
        return "{\"type\":\"status\",\"data\":{\"currentBranch\":\"" + escapeJson(branch) + "\",\"detachedHead\":false,\"ahead\":0,\"behind\":0,\"staged\":[],\"unstaged\":[],\"untracked\":[],\"conflicts\":[],\"merging\":false,\"rebasing\":false,\"cherryPicking\":false}" + HOST_SUFFIX;
    }

    private String handleRequestBranches() throws IOException, InterruptedException {
        String branchesOutput = executeGit(GIT_BRANCH_CMD, "-a", "--format=%(refname:short)|%(HEAD)");
        StringBuilder sb = new StringBuilder("[");
        String[] lines = branchesOutput.split("\n");
        boolean first = true;
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                String[] parts = trimmed.split("\\|");
                String name = escapeJson(parts.length > 0 ? parts[0].trim() : "");
                boolean isHead = parts.length > 1 && "*".equals(parts[1].trim());
                boolean isRemote = name.startsWith("origin/") || name.startsWith("remotes/");
                if (!first) sb.append(",");
                sb.append(JSON_NAME_PREFIX).append(name).append("\",\"isRemote\":").append(isRemote)
                  .append(",\"isCurrent\":").append(isHead)
                  .append(",\"hash\":\"\",\"lastCommitDate\":0,\"lastCommitSubject\":\"\"}");
                first = false;
            }
        }
        sb.append("]");
        return "{\"type\":\"branches\",\"data\":" + sb.toString() + HOST_SUFFIX;
    }

    private String handleRequestTags() throws IOException, InterruptedException {
        String tagsOutput = executeGit("tag", "-l", "--format=%(refname:short)|%(objectname:short)");
        StringBuilder sb = new StringBuilder("[");
        String[] lines = tagsOutput.split("\n");
        boolean first = true;
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                String[] parts = trimmed.split("\\|");
                String name = escapeJson(parts.length > 0 ? parts[0].trim() : "");
                String hash = escapeJson(parts.length > 1 ? parts[1].trim() : "");
                if (!first) sb.append(",");
                sb.append(JSON_NAME_PREFIX).append(name).append("\",\"hash\":\"").append(hash).append("\"}");
                first = false;
            }
        }
        sb.append("]");
        return "{\"type\":\"tags\",\"data\":" + sb.toString() + HOST_SUFFIX;
    }

    private String handleCheckoutBranch(String jsonMessage) throws IOException, InterruptedException {
        String branchName = extractStringProp(jsonMessage, "name");
        if (!branchName.isEmpty()) {
            executeGit("checkout", branchName);
            return handleMessage("{\"type\":\"requestStatus\"}");
        }
        return null;
    }

    private String handleCreateBranch(String jsonMessage) throws IOException, InterruptedException {
        String branchName = extractStringProp(jsonMessage, "name");
        String startPoint = extractStringProp(jsonMessage, "startPoint");
        if (!branchName.isEmpty()) {
            if (!startPoint.isEmpty()) {
                executeGit(GIT_BRANCH_CMD, branchName, startPoint);
            } else {
                executeGit(GIT_BRANCH_CMD, branchName);
            }
            return handleMessage("{\"type\":\"requestBranches\"}");
        }
        return null;
    }

    private String handleDeleteBranch(String jsonMessage) throws IOException, InterruptedException {
        String branchName = extractStringProp(jsonMessage, "name");
        if (!branchName.isEmpty()) {
            executeGit(GIT_BRANCH_CMD, "-D", branchName);
            return handleMessage("{\"type\":\"requestBranches\"}");
        }
        return null;
    }

    private String parseCommitsOutput(String output) {
        StringBuilder sb = new StringBuilder("[");
        String[] lines = output.split("\n");
        boolean first = true;
        for (String line : lines) {
            String commitJson = parseSingleCommit(line);
            if (commitJson != null) {
                if (!first) sb.append(",");
                sb.append(commitJson);
                first = false;
            }
        }
        sb.append("]");
        return sb.toString();
    }

    private String parseSingleCommit(String line) {
        if (line.trim().isEmpty()) return null;
        String[] parts = line.split("\u001e");
        if (parts.length < 7) return null;

        String hash = parts[0].trim();
        String shortHash = parts[1].trim();
        String parentsJson = formatParents(parts[2].trim());
        String subject = escapeJson(parts[3].trim());
        String authorName = escapeJson(parts[4].trim());
        String authorEmail = escapeJson(parts[5].trim());
        String authorDate = parts[6].trim();
        String refsRaw = parts.length > 7 ? parts[7].trim() : "";
        String refsList = parseDecorations(refsRaw);

        return "{\"hash\":\"" + hash + "\","
             + "\"shortHash\":\"" + shortHash + "\","
             + "\"parents\":[" + parentsJson + "],"
             + "\"subject\":\"" + subject + "\","
             + "\"body\":\"\","
             + "\"author\":{\"name\":\"" + authorName + "\",\"email\":\"" + authorEmail + "\"},"
             + "\"authorDate\":" + (authorDate.isEmpty() ? "0" : authorDate) + ","
             + "\"committer\":{\"name\":\"" + authorName + "\",\"email\":\"" + authorEmail + "\"},"
             + "\"commitDate\":" + (authorDate.isEmpty() ? "0" : authorDate) + ","
             + "\"refs\":[" + refsList + "]}";
    }

    private String formatParents(String parentsStr) {
        String[] parentList = parentsStr.split(" ");
        StringBuilder parentsJson = new StringBuilder();
        for (String parent : parentList) {
            String trimmed = parent.trim();
            if (!trimmed.isEmpty()) {
                if (parentsJson.length() > 0) parentsJson.append(",");
                parentsJson.append("\"").append(trimmed).append("\"");
            }
        }
        return parentsJson.toString();
    }

    private String parseDecorations(String raw) {
        if (raw == null || raw.trim().isEmpty()) return "";
        String cleaned = raw.replaceAll("^\\(", "").replaceAll("\\)$", "").trim();
        if (cleaned.isEmpty()) return "";
        String[] refs = cleaned.split(",");
        StringBuilder sb = new StringBuilder();
        for (String ref : refs) {
            String refJson = parseSingleRef(ref);
            if (refJson != null) {
                if (sb.length() > 0) sb.append(",");
                sb.append(refJson);
            }
        }
        return sb.toString();
    }

    private static final String TYPE_HEAD = "head";
    private static final String TYPE_TAG = "tag";
    private static final String TYPE_REMOTE = "remote";

    private String parseSingleRef(String ref) {
        String trimmed = ref.trim();
        if (trimmed.isEmpty()) return null;
        boolean isHead = trimmed.startsWith(HEAD_PREFIX);
        String name = escapeJson(trimmed.replace(HEAD_PREFIX, "").replace(TAG_PREFIX, "").trim());
        String type = determineRefType(trimmed, name);
        return JSON_NAME_PREFIX + name + "\",\"type\":\"" + type + "\",\"isHead\":" + isHead + "}";
    }

    private String determineRefType(String ref, String name) {
        if (ref.startsWith(HEAD_PREFIX)) {
            return TYPE_HEAD;
        }
        if (ref.startsWith(TAG_PREFIX)) {
            return TYPE_TAG;
        }
        if (name.contains("/")) {
            return TYPE_REMOTE;
        }
        return TYPE_HEAD;
    }

    private String extractStringProp(String json, String prop) {
        java.util.regex.Pattern p = java.util.regex.Pattern.compile("\"" + prop + "\"\\s*:\\s*\"([^\"]+)\"");
        java.util.regex.Matcher m = p.matcher(json);
        return m.find() ? m.group(1) : "";
    }

    private String escapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\b", "\\b")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t");
    }

    private String executeGit(String... args) throws IOException, InterruptedException {
        String[] cmd = new String[args.length + 1];
        cmd[0] = "git";
        System.arraycopy(args, 0, cmd, 1, args.length);

        Process process = Runtime.getRuntime().exec(cmd);
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
        }
        process.waitFor();
        return sb.toString();
    }
}
