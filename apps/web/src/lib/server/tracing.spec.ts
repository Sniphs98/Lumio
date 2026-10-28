import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { trace } from '@opentelemetry/api';
import { describe, expect, it } from 'vitest';
import { startTracing, tracingConfig } from './tracing.ts';

describe('tracingConfig', () => {
	it('is off without an OTLP endpoint', () => {
		expect(tracingConfig({})).toBeNull();
		expect(tracingConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: '  ' })).toBeNull();
	});

	it('turns on with a general or traces endpoint', () => {
		expect(tracingConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://jaeger:4318' })).toEqual({
			serviceName: 'lumio'
		});
		expect(
			tracingConfig({ OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://jaeger:4318/v1/traces' })
		).toEqual({ serviceName: 'lumio' });
	});

	it('uses OTEL_SERVICE_NAME', () => {
		expect(
			tracingConfig({
				OTEL_EXPORTER_OTLP_ENDPOINT: 'http://jaeger:4318',
				OTEL_SERVICE_NAME: 'lumio-staging'
			})
		).toEqual({ serviceName: 'lumio-staging' });
	});

	it('respects OTEL_SDK_DISABLED', () => {
		expect(
			tracingConfig({
				OTEL_EXPORTER_OTLP_ENDPOINT: 'http://jaeger:4318',
				OTEL_SDK_DISABLED: 'true'
			})
		).toBeNull();
	});
});

describe('startTracing', () => {
	it('does nothing when tracing is off', async () => {
		expect(await startTracing({})).toBeNull();
	});

	it('exports spans to the OTLP endpoint', async () => {
		const requests: { url?: string; body: Buffer }[] = [];
		const server = createServer(async (req: IncomingMessage, res) => {
			const chunks: Buffer[] = [];
			for await (const chunk of req) chunks.push(chunk);
			requests.push({ url: req.url, body: Buffer.concat(chunks) });
			res.writeHead(200, { 'content-type': 'application/x-protobuf' }).end();
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const { port } = server.address() as AddressInfo;

		// The exporter reads its URL from the environment, like in production.
		const previous = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = `http://127.0.0.1:${port}`;
		try {
			const stop = await startTracing(process.env);
			expect(stop).not.toBeNull();

			trace.getTracer('test').startActiveSpan('tracing-spec-span', (span) => span.end());
			await stop!();

			expect(requests).toHaveLength(1);
			expect(requests[0].url).toBe('/v1/traces');
			expect(requests[0].body.toString('latin1')).toContain('tracing-spec-span');
			expect(requests[0].body.toString('latin1')).toContain('lumio');
		} finally {
			if (previous === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
			else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = previous;
			server.close();
		}
	});
});
