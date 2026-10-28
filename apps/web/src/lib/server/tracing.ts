// Optional OpenTelemetry tracing. SvelteKit emits spans for `handle`, `load`
// functions, form actions and `+server` handlers (`tracing.server` in
// vite.config.ts); this module only decides whether to export them. Without an
// OTLP endpoint nothing is loaded and the spans stay no-ops.

type Env = Record<string, string | undefined>;

export interface TracingConfig {
	serviceName: string;
}

/** Reads the standard `OTEL_*` variables. Returns `null` when tracing is off. */
export function tracingConfig(env: Env): TracingConfig | null {
	if (env.OTEL_SDK_DISABLED?.trim().toLowerCase() === 'true') return null;

	const endpoint =
		env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim() || env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
	if (!endpoint) return null;

	return { serviceName: env.OTEL_SERVICE_NAME?.trim() || 'lumio' };
}

/**
 * Registers a global tracer provider that sends spans over OTLP/HTTP (protobuf).
 * The exporter reads endpoint, headers and timeout from the `OTEL_EXPORTER_OTLP_*`
 * variables itself. Returns a function that flushes and stops the provider, or
 * `null` when tracing is off.
 */
export async function startTracing(env: Env): Promise<(() => Promise<void>) | null> {
	const config = tracingConfig(env);
	if (!config) return null;

	const [api, { AsyncLocalStorageContextManager }, core, resources, sdk, { OTLPTraceExporter }] =
		await Promise.all([
			import('@opentelemetry/api'),
			import('@opentelemetry/context-async-hooks'),
			import('@opentelemetry/core'),
			import('@opentelemetry/resources'),
			import('@opentelemetry/sdk-trace'),
			import('@opentelemetry/exporter-trace-otlp-proto')
		]);

	const resource = resources
		.defaultResource()
		.merge(
			resources.detectResources({
				detectors: [resources.hostDetector, resources.processDetector, resources.envDetector]
			})
		)
		.merge(resources.resourceFromAttributes({ 'service.name': config.serviceName }));

	const provider = new sdk.TracerProvider({
		resource,
		spanProcessors: [new sdk.BatchSpanProcessor({ exporter: new OTLPTraceExporter() })]
	});

	api.context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
	// Continues traces from a `traceparent` header, e.g. set by a reverse proxy.
	api.propagation.setGlobalPropagator(
		new core.CompositePropagator({
			propagators: [new core.W3CTraceContextPropagator(), new core.W3CBaggagePropagator()]
		})
	);
	api.trace.setGlobalTracerProvider(provider);

	return async () => {
		await provider.shutdown();
		api.trace.disable();
		api.propagation.disable();
		api.context.disable();
	};
}
