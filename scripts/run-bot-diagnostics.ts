import { generateBotDiagnosticsReport } from "../tests/bot-diagnostics";

const diagnostics = generateBotDiagnosticsReport();

process.stdout.write(`${diagnostics.report}\n`);
