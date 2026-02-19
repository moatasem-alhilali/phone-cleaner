/// <reference lib="webworker" />
import { COUNTRIES } from "../domain/countries";
import {
  analyzeInput,
  buildProcessingContext,
  buildReport,
  processLine,
} from "../domain/report";
import type {
  NormalizedRow,
  WorkerRequest,
  WorkerResponse,
} from "../domain/types";

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const { input, settings } = event.data;
    const lines = input.split(/\r?\n/);
    const hints = analyzeInput(lines);
    const context = buildProcessingContext(COUNTRIES, settings);

    const rows: NormalizedRow[] = [];
    const total = lines.length;
    const chunkSize = 500;
    const startTime = Date.now();

    for (let i = 0; i < total; i += 1) {
      rows.push(processLine(lines[i] ?? "", i, context, hints));

      if (i % chunkSize === 0 && i > 0) {
        const progressMessage: WorkerResponse = {
          type: "progress",
          processed: i,
          total,
        };
        ctx.postMessage(progressMessage);
      }
    }

    const durationMs = Date.now() - startTime;
    const report = buildReport(rows, settings, hints, durationMs);
    const doneMessage: WorkerResponse = { type: "done", report };
    ctx.postMessage(doneMessage);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown worker error";
    const errorMessage: WorkerResponse = { type: "error", message };
    ctx.postMessage(errorMessage);
  }
};
