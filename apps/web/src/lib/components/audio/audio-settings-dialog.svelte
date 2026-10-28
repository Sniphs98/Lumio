<script lang="ts">
	import { Mic, Square } from '@lucide/svelte';
	import {
		audioDevices,
		captureOptions,
		deviceLabel,
		type AudioSettings
	} from '#lib/audio-settings.ts';
	import type { AudioControls } from '#lib/call.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Dialog from '#lib/components/ui/dialog/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { Progress } from '#lib/components/ui/progress/index.ts';
	import * as Select from '#lib/components/ui/select/index.ts';
	import { Separator } from '#lib/components/ui/separator/index.ts';
	import { Slider } from '#lib/components/ui/slider/index.ts';
	import { Switch } from '#lib/components/ui/switch/index.ts';

	type Props = {
		audio: AudioControls;
		open?: boolean;
		/** The browser's audio devices. Tests pass a fixed list. */
		listDevices?: () => Promise<Pick<MediaDeviceInfo, 'deviceId' | 'kind' | 'label'>[]>;
	};

	let { audio, open = $bindable(false), listDevices = enumerateDevices }: Props = $props();

	async function enumerateDevices() {
		return (await navigator.mediaDevices?.enumerateDevices()) ?? [];
	}

	let devices = $state.raw<Pick<MediaDeviceInfo, 'deviceId' | 'kind' | 'label'>[]>([]);
	const microphones = $derived(audioDevices(devices, 'audioinput'));
	const speakers = $derived(audioDevices(devices, 'audiooutput'));

	async function refreshDevices() {
		try {
			devices = await listDevices();
		} catch {
			devices = [];
		}
	}

	// Plugging in a headset while the dialog is open shows it right away.
	$effect(() => {
		if (!open) return;
		void refreshDevices();
		const media = navigator.mediaDevices;
		media?.addEventListener('devicechange', refreshDevices);
		return () => media?.removeEventListener('devicechange', refreshDevices);
	});

	const processing = [
		{
			key: 'noiseSuppression',
			label: 'Noise suppression',
			description: 'Filters out background noise like fans, typing or traffic.'
		},
		{
			key: 'echoCancellation',
			label: 'Echo cancellation',
			description: 'Keeps others from hearing themselves when you use speakers.'
		},
		{
			key: 'autoGainControl',
			label: 'Automatic gain control',
			description: 'Evens out your volume when you move closer to or away from the microphone.'
		}
	] as const satisfies { key: keyof AudioSettings; label: string; description: string }[];

	// Microphone test: shows how loud the microphone is, with the chosen device and processing.
	let testing = $state(false);
	let level = $state(0);
	let testError = $state<string | null>(null);
	// A string, so changing the volume does not restart the test.
	const constraints = $derived(JSON.stringify(captureOptions(audio.settings)));

	$effect(() => {
		if (!open || !testing) return;
		const { deviceId, ...voice } = JSON.parse(constraints) as ReturnType<typeof captureOptions>;
		let stopped = false;
		let stream: MediaStream | undefined;
		let context: AudioContext | undefined;
		let frame = 0;
		testError = null;

		navigator.mediaDevices
			.getUserMedia({
				audio: { ...voice, deviceId: deviceId ? { exact: deviceId } : undefined }
			})
			.then((s) => {
				stream = s;
				if (stopped) return s.getTracks().forEach((t) => t.stop());
				// Device names are only visible once the site may use the microphone.
				void refreshDevices();
				context = new AudioContext();
				const analyser = context.createAnalyser();
				analyser.fftSize = 1024;
				context.createMediaStreamSource(s).connect(analyser);
				const samples = new Float32Array(analyser.fftSize);
				const tick = () => {
					analyser.getFloatTimeDomainData(samples);
					let sum = 0;
					for (const x of samples) sum += x * x;
					// Speech has an RMS of roughly 0.05 to 0.2; scale that to most of the bar.
					level = Math.min(100, Math.sqrt(sum / samples.length) * 500);
					frame = requestAnimationFrame(tick);
				};
				tick();
			})
			.catch(() => {
				if (stopped) return;
				testError = 'No microphone access. Allow it in your browser to test.';
				testing = false;
			});

		return () => {
			stopped = true;
			cancelAnimationFrame(frame);
			stream?.getTracks().forEach((t) => t.stop());
			void context?.close();
			level = 0;
		};
	});

	$effect(() => {
		if (!open) testing = false;
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Audio settings</Dialog.Title>
			<Dialog.Description>Saved in this browser and used for every call.</Dialog.Description>
		</Dialog.Header>

		<section class="grid gap-4" aria-labelledby="audio-devices-heading">
			<h3 id="audio-devices-heading" class="text-xs font-semibold text-muted-foreground uppercase">
				Devices
			</h3>
			<div class="grid gap-2">
				<Label for="audio-input">Microphone</Label>
				<Select.Root
					type="single"
					value={audio.settings.inputDeviceId}
					onValueChange={(inputDeviceId) => audio.updateSettings({ inputDeviceId })}
				>
					<Select.Trigger id="audio-input" class="w-full data-[size=default]:h-9">
						<span class="truncate">{deviceLabel(microphones, audio.settings.inputDeviceId)}</span>
					</Select.Trigger>
					<Select.Content>
						{#each microphones as d (d.id)}
							<Select.Item value={d.id} label={d.label} />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<div class="grid gap-2">
				<div class="flex items-center justify-between gap-2">
					<Label>Microphone test</Label>
					<Button variant="outline" size="sm" onclick={() => (testing = !testing)}>
						{#if testing}<Square />Stop{:else}<Mic />Test{/if}
					</Button>
				</div>
				<Progress value={level} aria-label="Microphone level" />
				{#if testError}
					<p class="text-xs text-destructive" role="alert">{testError}</p>
				{:else if testing}
					<p class="text-xs text-muted-foreground">Say something: the bar moves when you speak.</p>
				{/if}
			</div>

			<div class="grid gap-2">
				<Label for="audio-output">Speakers</Label>
				<Select.Root
					type="single"
					value={audio.settings.outputDeviceId}
					onValueChange={(outputDeviceId) => audio.updateSettings({ outputDeviceId })}
					disabled={!audio.outputSelectionSupported}
				>
					<Select.Trigger id="audio-output" class="w-full data-[size=default]:h-9">
						<span class="truncate">{deviceLabel(speakers, audio.settings.outputDeviceId)}</span>
					</Select.Trigger>
					<Select.Content>
						{#each speakers as d (d.id)}
							<Select.Item value={d.id} label={d.label} />
						{/each}
					</Select.Content>
				</Select.Root>
				{#if !audio.outputSelectionSupported}
					<p class="text-xs text-muted-foreground">
						This browser always plays through the system's speakers. Change them in your system
						settings.
					</p>
				{/if}
			</div>

			<div class="grid gap-3">
				<div class="flex items-center justify-between">
					<Label id="output-volume-label">Call volume</Label>
					<span class="text-xs text-muted-foreground tabular-nums">
						{Math.round(audio.settings.outputVolume * 100)}%
					</span>
				</div>
				<Slider
					type="single"
					value={Math.round(audio.settings.outputVolume * 100)}
					onValueChange={(v) => audio.updateSettings({ outputVolume: v / 100 })}
					max={100}
					step={1}
					aria-labelledby="output-volume-label"
				/>
			</div>
		</section>

		<Separator />

		<section class="grid gap-4" aria-labelledby="voice-processing-heading">
			<h3
				id="voice-processing-heading"
				class="text-xs font-semibold text-muted-foreground uppercase"
			>
				Voice processing
			</h3>
			{#each processing as option (option.key)}
				<div class="flex items-start justify-between gap-4">
					<div class="grid gap-1">
						<Label for="audio-{option.key}">{option.label}</Label>
						<p class="text-xs text-muted-foreground">{option.description}</p>
					</div>
					<Switch
						id="audio-{option.key}"
						checked={audio.settings[option.key]}
						onCheckedChange={(checked) => audio.updateSettings({ [option.key]: checked })}
					/>
				</div>
			{/each}
		</section>
	</Dialog.Content>
</Dialog.Root>
