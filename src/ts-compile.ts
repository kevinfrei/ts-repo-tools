import * as ts from 'typescript';
import { promises as fsp } from 'node:fs';
import * as path from 'node:path';

// Shamelessy stolen and then cleaned up a bunch from
// https://github.com/Microsoft/TypeScript/issues/6387#issuecomment-169739615

type ConfigJsonEntries = Record<string, string | boolean | string[]>;
type ConfigJson = {
  compilerOptions: ConfigJsonEntries;
  include?: string[];
  exclude?: string[];
};

// Common compiler options:
const cfgBase: ConfigJsonEntries = {
  target: 'ES2020',
  downlevelIteration: true,
  strict: true,
  noFallthroughCasesInSwitch: true,
  moduleResolution: 'node',
  esModuleInterop: true,
  skipLibCheck: true,
  forceConsistentCasingInFileNames: true,
  newLine: 'lf',
};

// cjs common options:
const cjsBase: ConfigJsonEntries = {
  ...cfgBase,
  module: 'commonjs',
  outDir: './lib/cjs/',
};

// esm common options
const esmBase: ConfigJsonEntries = {
  ...cfgBase,
  module: 'ES2020',
  declaration: true,
  outDir: './lib/esm/',
};

// debug common options
const sharedDbg: ConfigJsonEntries = {
  inlineSourceMap: true,
  incremental: true,
  removeComments: false,
  sourceMap: true,
};

// opt common options
const sharedOpt: ConfigJsonEntries = {
  removeComments: true,
  sourceMap: false,
};

const fileSelection = {
  include: ['src'],
  exclude: ['node_modules', '**/__tests__/*'],
};

type ConfigKeys = 'cjs' | 'esm' | 'cjsopt' | 'esmopt';
const configs: Record<ConfigKeys, ConfigJson> = {
  cjs: {
    compilerOptions: {
      ...cjsBase,
      ...sharedDbg,
      tsBuildInfoFile: './.cjs.tsbuildinfo',
    },
    ...fileSelection,
  },
  cjsopt: {
    compilerOptions: { ...cjsBase, ...sharedOpt },
    ...fileSelection,
  },
  esm: {
    compilerOptions: {
      ...esmBase,
      ...sharedDbg,
      tsBuildInfoFile: './.esm.tsbuildinfo',
      declarationMap: true,
    },
    ...fileSelection,
  },
  esmopt: {
    compilerOptions: { ...esmBase, ...sharedOpt },
    ...fileSelection,
  },
};

function getFileAndLine(diagnostic: ts.Diagnostic): string {
  if (diagnostic.file) {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start || 0,
    );
    return `${diagnostic.file.fileName} (${line + 1},${character + 1})`;
  }
  return '';
}

function reportDiagnostics(diagnostics: ts.Diagnostic[]): string[] {
  return diagnostics.map(
    (diagnostic) =>
      `Error ${getFileAndLine(diagnostic)}: ${ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n',
      )}`,
  );
}

function processConfig(
  configFileName: string,
  configFileText: string,
): ts.ParsedCommandLine | string[] {
  // Parse JSON, after removing comments. Just fancier JSON.parse
  const result = ts.parseConfigFileTextToJson(configFileName, configFileText);
  const configObject: unknown = result.config;
  if (!configObject) {
    return reportDiagnostics(result.error ? [result.error] : []);
  }

  // Extract config information
  const configParseResult = ts.parseJsonConfigFileContent(
    configObject,
    ts.sys,
    path.dirname(configFileName),
  );

  if (configParseResult.errors.length > 0) {
    return reportDiagnostics(configParseResult.errors);
  }
  return configParseResult;
}

export function TSCompileWithConfig(
  configJson: string,
  fakeFileName = 'imaginary_tsconfig.json',
): number | string[] {
  const config = processConfig(fakeFileName, configJson);
  if (Array.isArray(config)) {
    return config;
  }
  // Compile
  const program = ts.createProgram(config.fileNames, config.options);
  const emitResult = program.emit();

  // Report errors
  reportDiagnostics(
    ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics),
  );

  return emitResult.emitSkipped ? 1 : 0;
}

export async function TSCompileWithConfigFile(
  configFileName: string,
): Promise<number | string[]> {
  // Extract configuration from config file
  const cfgJson = (await fsp.readFile(configFileName)).toString();
  return TSCompileWithConfig(cfgJson, configFileName);
}

export function TSCompile(config: ConfigKeys): number | string[] {
  return TSCompileWithConfig(
    JSON.stringify(configs[config]),
    `tsconfig.${config}.json`,
  );
}
