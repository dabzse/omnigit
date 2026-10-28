plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.22"
    id("org.jetbrains.intellij.platform") version "2.0.0"
}

group = "net.dabzse.omnigit"
version = "0.0.1"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity("2024.1")
        bundledPlugin("Git4Idea")
        pluginVerifier()
        zipSigner()
    }
}

intellijPlatform {
    pluginConfiguration {
        id = "net.dabzse.omnigit.intellij"
        name = "OmniGit"
        version = project.version.toString()
        description = "Universal Git Graph visualization and GitLens-style productivity tool for JetBrains IDEs"
        vendor {
            name = "Mihaly Nyilas"
        }
    }
}

kotlin {
    jvmToolchain(17)
}
