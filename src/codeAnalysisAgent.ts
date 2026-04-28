import * as fs from "node:fs";
import * as path from "node:path";

export interface ExtensionCommand {
  command: string;
  title: string;
  when?: string;
  group?: string;
}

export interface ExtensionFeature {
  type: "command" | "ui" | "configuration" | "menu" | "other";
  name: string;
  description: string;
  activationEvents?: string[];
  contributes?: Record<string, any>;
  files?: string[];
}

export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  contributes?: {
    commands?: Array<{ command: string; title: string }>;
    menus?: Record<string, any>;
    configuration?: any;
  };
  activationEvents?: string[];
  [key: string]: any;
}

export interface AnalysisResult {
  packageInfo: PackageInfo;
  commands: ExtensionCommand[];
  features: ExtensionFeature[];
  activationEvents: string[];
  sourceFiles: string[];
  uiContributions: Array<{ type: string; location: string; items: any[] }>;
  configuration: any;
}

export class CodeAnalysisAgent {
  private projectRoot: string;
  private srcPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.srcPath = path.join(projectRoot, "src");
  }

  public async analyze(): Promise<AnalysisResult> {
    const packageInfo = await this.readPackageJson();
    const commands = this.extractCommands(packageInfo);
    const activationEvents = packageInfo.activationEvents || [];
    const features = this.extractFeatures(packageInfo, commands);
    const sourceFiles = await this.findSourceFiles();
    const uiContributions = this.extractUIContributions(packageInfo);
    const configuration = packageInfo.contributes?.configuration || {};

    return {
      packageInfo,
      commands,
      features,
      activationEvents,
      sourceFiles,
      uiContributions,
      configuration,
    };
  }

  private async readPackageJson(): Promise<PackageInfo> {
    const packagePath = path.join(this.projectRoot, "package.json");
    const content = await fs.promises.readFile(packagePath, "utf-8");
    return JSON.parse(content);
  }

  private extractCommands(packageInfo: PackageInfo): ExtensionCommand[] {
    const commands: ExtensionCommand[] = [];
    const commandContributions = packageInfo.contributes?.commands || [];

    commandContributions.forEach((cmd: any) => {
      commands.push({
        command: cmd.command,
        title: cmd.title,
      });
    });

    // Extract menu commands with when clauses
    const menuContributions = packageInfo.contributes?.menus || {};
    Object.keys(menuContributions).forEach((menuKey: string) => {
      menuContributions[menuKey].forEach((menuItem: any) => {
        const existingCmd = commands.find((c) => c.command === menuItem.command);
        if (existingCmd) {
          existingCmd.when = menuItem.when;
          existingCmd.group = menuItem.group;
        } else {
          commands.push({
            command: menuItem.command,
            title: menuItem.command,
            when: menuItem.when,
            group: menuItem.group,
          });
        }
      });
    });

    return commands;
  }

  private extractFeatures(
    packageInfo: PackageInfo,
    commands: ExtensionCommand[],
  ): ExtensionFeature[] {
    const features: ExtensionFeature[] = [];

    // Command features
    commands.forEach((cmd) => {
      features.push({
        type: "command",
        name: cmd.command,
        description: cmd.title,
        files: this.findCommandHandlers(cmd.command),
      });
    });

    // UI contributions
    const menus = packageInfo.contributes?.menus || {};
    Object.keys(menus).forEach((menuKey: string) => {
      features.push({
        type: "menu",
        name: `Menu: ${menuKey}`,
        description: `Context menu contributions for ${menuKey}`,
        files: [],
      });
    });

    // Configuration features
    if (packageInfo.contributes?.configuration) {
      features.push({
        type: "configuration",
        name: "Extension Configuration",
        description: "User-configurable settings",
        files: [],
      });
    }

    return features;
  }

  private findCommandHandlers(commandName: string): string[] {
    // In a real implementation, this would parse source files
    // For now, return all source files that might handle commands
    return this.srcPath ? [this.srcPath] : [];
  }

  private async findSourceFiles(): Promise<string[]> {
    const files: string[] = [];

    const scanDir = async (dir: string) => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith(".ts")) {
            files.push(path.relative(this.projectRoot, fullPath));
          }
        }
      } catch (err) {
        // Directory doesn't exist or can't be read
        if (process.env.NODE_ENV === "development") {
          console.debug(`Cannot read directory ${dir}:`, err);
        }
      }
    };

    await scanDir(this.srcPath);
    return files;
  }

  private extractUIContributions(
    packageInfo: PackageInfo,
  ): Array<{ type: string; location: string; items: any[] }> {
    const contributions: Array<{ type: string; location: string; items: any[] }> = [];
    const menus = packageInfo.contributes?.menus || {};

    Object.keys(menus).forEach((menuKey: string) => {
      contributions.push({
        type: "menu",
        location: menuKey,
        items: menus[menuKey],
      });
    });

    return contributions;
  }
}
