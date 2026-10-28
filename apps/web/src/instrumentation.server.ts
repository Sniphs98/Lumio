// Loaded by SvelteKit before any application code. Tracing is off unless
// OTEL_EXPORTER_OTLP_ENDPOINT is set; see "Tracing" in the README.
import { startTracing } from '#lib/server/tracing.ts';

const stopTracing = await startTracing(process.env);

if (stopTracing) {
	// Emitted by adapter-node after a graceful shutdown; flushes the last spans.
	process.on('sveltekit:shutdown', () => {
		stopTracing().catch((error) => console.error('Failed to flush traces', error));
	});
}
