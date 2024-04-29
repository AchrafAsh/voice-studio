import { useEffect, useMemo, useRef, useState } from "react";
// Wavesurfer
import { useWavesurfer } from "@wavesurfer/react";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.esm.js";
import MinimapPlugin from "wavesurfer.js/dist/plugins/minimap.esm.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";

import TextareaAutosize from "react-textarea-autosize";
import { Button, Icons } from "@/components";

import Controls from "./controls";
import Player from "./player";

type Block = {
    id?: string;
    from: number;
    to: number;
    text: string;
    source: "mic" | "system";
    speaker_id?: number;
};
interface Transcript {
    startTime: number;
    endTime: number;
    blocks: Block[];
}
interface Track {
    name: string;
    audio: string;
    duration: number;
    offset: number;
}

export default function App() {
    const [transcript, setTranscript] = useState<Transcript>();
    const [track, setTrack] = useState<Track>();
    const [activeBlockId, setActiveBlockId] = useState<string>();

    const playerRef = useRef<HTMLDivElement>(null);
    const regionsPlugin = useMemo(() => {
        const regionsPlugin = new RegionsPlugin();
        regionsPlugin.on("region-in", (region) => {
            setActiveBlockId(region.id);
        });
        regionsPlugin.on("region-out", (region) => {
            if (activeBlockId === region.id) setActiveBlockId(undefined);
        });
        regionsPlugin.on("region-updated", (region) => {
            setTranscript(
                (prev) =>
                    prev && {
                        ...prev,
                        blocks: prev.blocks
                            .map((block) => {
                                if (block.id !== region.id) return block;

                                return {
                                    ...block,
                                    from: region.start,
                                    to: region.end,
                                };
                            })
                            .sort((a, b) => a.from - b.from),
                    },
            );
        });

        return regionsPlugin;
    }, []);

    const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
        url: track?.audio,
        container: playerRef,
        waveColor: "#9ca3af",
        progressColor: "#fb923c",
        dragToSeek: true,
        interact: true,
        normalize: true,
        barGap: 2,
        barWidth: 2,
        barRadius: 2,
        height: 120,
        autoCenter: true,
        cursorColor: "#c2410c",
        minPxPerSec: 10,
        plugins: useMemo(() => {
            return [
                regionsPlugin,
                new TimelinePlugin({
                    insertPosition: "afterend",
                    // TODO: provide a container to put it where I want
                }),
                new MinimapPlugin({
                    cursorWidth: 0,
                    waveColor: "#cbd5e1",
                    overlayColor: "transparent",
                    progressColor: "#0f172a",
                    barGap: 0,
                    barWidth: 1,
                    // TODO: provide a container to put it where I want
                }),
            ];
        }, []),
    });

    // Registering wavesurfer events
    useEffect(() => {
        if (!wavesurfer) return;

        const unsubscribe = wavesurfer.on("ready", () => {
            if (transcript?.blocks) {
                transcript.blocks.forEach((block) => {
                    regionsPlugin.addRegion({
                        id: block.id,
                        start: block.from - transcript.startTime,
                        end: block.to - transcript.startTime,
                    });
                    console.log(`created region #${block.id}`);
                });
            }
        });

        return () => {
            unsubscribe();
        };
    }, [wavesurfer]);

    async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        // Compute duration
        const audioContext = new window.AudioContext();
        const arrayBuffer = await file.arrayBuffer();
        const duration = await new Promise<number>((resolve) =>
            audioContext.decodeAudioData(arrayBuffer, (buffer) => {
                resolve(buffer.duration);
            }),
        );

        // Initialize transcript
        setTranscript((prev) => ({
            startTime: 0,
            // TODO: use ms timestamps for transcript
            endTime:
                prev?.endTime && prev.endTime > duration
                    ? prev.endTime
                    : duration,
            blocks: [],
        }));

        const audioURL = URL.createObjectURL(file);
        setTrack({
            name: file.name,
            duration,
            audio: audioURL,
            offset: 0,
        });
    }

    if (track && transcript) {
        return (
            <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
                <header className="grid grid-cols-3 border-b bg-white">
                    <div className="">
                        <button className="relative h-full cursor-default p-3 hover:bg-slate-100">
                            <Icons.FileAudio2
                                size={18}
                                className="text-slate-700"
                            />
                            <input
                                className="absolute inset-0 opacity-0"
                                type="file"
                                name="audio_files"
                                id="audio_files"
                                accept=".wav"
                                onChange={(e) => {
                                    onUpload(e);
                                }}
                            />
                        </button>
                    </div>
                    <div className="flex items-center justify-center space-x-1 p-2 text-xs">
                        <span className="text-slate-500">Drafts</span>
                        <span className="text-slate-500">/</span>
                        <span>Untitled</span>
                    </div>
                    <div className="flex justify-end px-4 py-2">
                        <button className="flex cursor-default items-center space-x-1.5 rounded-md bg-indigo-600 py-1.5 pl-2 pr-3 text-xs font-medium text-white">
                            <Icons.FileJson2
                                size={14}
                                strokeWidth={2}
                                className="text-indigo-50"
                            />
                            <span>Export</span>
                        </button>
                    </div>
                </header>
                <div className="flex h-full flex-1 items-stretch overflow-hidden">
                    {/* Main Area */}
                    <div className="flex h-full flex-grow flex-col divide-y overflow-hidden">
                        {/* Transcription Area */}
                        <div className="mx-auto h-full w-full max-w-2xl flex-1 space-y-0.5 divide-y divide-slate-50 overflow-y-scroll border-x bg-white py-8">
                            {transcript.blocks.map((currentBlock) => (
                                <div
                                    key={currentBlock.id}
                                    className="relative px-8 outline -outline-offset-1 outline-transparent hover:outline-indigo-500"
                                >
                                    {/* <div className="absolute right-0 top-0 m-2 rounded border bg-slate-100 px-2 py-0.5 text-xs">
                                        speaker #0
                                    </div> */}
                                    <TextareaAutosize
                                        key={currentBlock.id}
                                        minRows={1}
                                        name="transcription"
                                        disabled={
                                            currentBlock.id !== activeBlockId
                                        }
                                        autoFocus={
                                            currentBlock.id === activeBlockId
                                        }
                                        placeholder="Start transcribing"
                                        defaultValue={currentBlock.text}
                                        onChange={(e) => {
                                            setTranscript(
                                                (prev) =>
                                                    prev && {
                                                        ...prev,
                                                        blocks: prev.blocks.map(
                                                            (block) =>
                                                                block.id !==
                                                                currentBlock.id
                                                                    ? block
                                                                    : {
                                                                          ...currentBlock,
                                                                          text: e
                                                                              .target
                                                                              .value,
                                                                      },
                                                        ),
                                                    },
                                            );
                                        }}
                                        className="mx-auto flex w-full max-w-xl resize-none bg-white py-4 text-sm text-slate-900 focus:outline-none disabled:text-opacity-50"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Track Players */}
                        <Player ref={playerRef} />

                        {/* Tools */}
                        <div className="flex justify-center bg-white p-2">
                            <Button
                                title="Add Segment"
                                variant="outline"
                                onClick={() => {
                                    const newRegion = regionsPlugin.addRegion({
                                        start: currentTime,
                                        end: currentTime + 5,
                                        resize: true,
                                        drag: true,
                                    });
                                    setTranscript(
                                        (prev) =>
                                            prev && {
                                                ...prev,
                                                blocks: [
                                                    ...prev.blocks,
                                                    {
                                                        id: newRegion.id,
                                                        from:
                                                            newRegion.start +
                                                            prev.startTime,
                                                        to:
                                                            newRegion.end +
                                                            prev.startTime,
                                                        text: "",
                                                        source: "system" as const,
                                                    },
                                                ].sort(
                                                    (a, b) => a.from - b.from,
                                                ), // FIXME: fails to properly sort the blocks
                                            },
                                    );
                                }}
                                className="rounded-full"
                            >
                                <Icons.Plus width={16} />
                                &nbsp;
                                <span className="text-xs">Add Segment</span>
                            </Button>
                        </div>

                        {/* Controls */}
                        <Controls
                            currentTime={currentTime}
                            duration={wavesurfer?.getDuration() || 0}
                            isPlaying={isPlaying}
                            onChange={(kv) => {
                                if (kv["playbackSpeed"]) {
                                    wavesurfer?.setOptions({
                                        audioRate: kv["playbackSpeed"],
                                    });
                                }
                                if (kv["time"]) {
                                    wavesurfer?.setTime(kv["time"]);
                                }
                                if (kv["zoom"]) {
                                    wavesurfer?.zoom(kv["zoom"]);
                                }
                            }}
                            onPlayPause={() => {
                                wavesurfer?.playPause();
                            }}
                            onSkip={(step) => {
                                wavesurfer?.skip(step);
                            }}
                        />
                    </div>

                    {/* Segments Menu */}
                    <nav className="flex w-[calc(min(15rem,25vw))] flex-shrink-0 flex-col divide-y border-l bg-white">
                        <div className="flex items-center space-x-2 px-4 py-2">
                            <Icons.FlipHorizontal
                                size={14}
                                className="text-slate-800"
                            />
                            <span className="text-sm font-medium">
                                Segments
                            </span>
                        </div>

                        <div className="flex-1">
                            {activeBlockId ? (
                                <div
                                    key={activeBlockId}
                                    className="flex space-x-2 p-4"
                                >
                                    <div className="grid grid-cols-2 gap-0.5">
                                        <div className="flex items-center border border-white outline-blue-500 focus-within:border-slate-200 focus-within:outline hover:border-slate-200">
                                            <div className="p-1">
                                                <Icons.PanelLeftDashed
                                                    size={16}
                                                    className="text-slate-300"
                                                />
                                            </div>
                                            <input
                                                className="w-full flex-1 py-1.5 pl-1 pr-0 text-xs focus:outline-none"
                                                type="text"
                                                name="from"
                                                id="from"
                                                value={
                                                    transcript.blocks.find(
                                                        (block) =>
                                                            block.id ===
                                                            activeBlockId,
                                                    )?.from
                                                }
                                                onChange={(e) => {
                                                    const value = Number(
                                                        e.target.value,
                                                    );
                                                    setTranscript(
                                                        (prev) =>
                                                            prev && {
                                                                ...prev,
                                                                blocks: prev.blocks.map(
                                                                    (block) => {
                                                                        if (
                                                                            block.id !==
                                                                            activeBlockId
                                                                        )
                                                                            return block;
                                                                        return {
                                                                            ...block,
                                                                            from: value,
                                                                        };
                                                                    },
                                                                ),
                                                            },
                                                    );
                                                    const blockRegion =
                                                        regionsPlugin
                                                            .getRegions()
                                                            .find(
                                                                (region) =>
                                                                    region.id ===
                                                                    activeBlockId,
                                                            );
                                                    if (!blockRegion) {
                                                        const activeBlock =
                                                            transcript.blocks.find(
                                                                (block) =>
                                                                    block.id ===
                                                                    activeBlockId,
                                                            );
                                                        regionsPlugin.addRegion(
                                                            {
                                                                id: activeBlockId,
                                                                start: value,
                                                                end: activeBlock!
                                                                    .to,
                                                            },
                                                        );
                                                    } else {
                                                        blockRegion.setOptions({
                                                            start: value,
                                                        });
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center border border-white outline-blue-500 focus-within:border-slate-200 focus-within:outline hover:border-slate-200">
                                            <input
                                                className="w-full flex-1 py-1.5 pl-2 pr-0 text-xs focus:outline-none"
                                                type="text"
                                                name="to"
                                                id="to"
                                                value={
                                                    transcript.blocks.find(
                                                        (block) =>
                                                            block.id ===
                                                            activeBlockId,
                                                    )?.to
                                                }
                                                onChange={(e) => {
                                                    const value = Number(
                                                        e.target.value,
                                                    );
                                                    setTranscript(
                                                        (prev) =>
                                                            prev && {
                                                                ...prev,
                                                                blocks: prev.blocks.map(
                                                                    (block) => {
                                                                        if (
                                                                            block.id !==
                                                                            activeBlockId
                                                                        )
                                                                            return block;
                                                                        return {
                                                                            ...block,
                                                                            to: value,
                                                                        };
                                                                    },
                                                                ),
                                                            },
                                                    );
                                                    const blockRegion =
                                                        regionsPlugin
                                                            .getRegions()
                                                            .find(
                                                                (region) =>
                                                                    region.id ===
                                                                    activeBlockId,
                                                            );
                                                    if (!blockRegion) {
                                                        const activeBlock =
                                                            transcript.blocks.find(
                                                                (block) =>
                                                                    block.id ===
                                                                    activeBlockId,
                                                            );
                                                        regionsPlugin.addRegion(
                                                            {
                                                                id: activeBlockId,
                                                                start: activeBlock!
                                                                    .from,
                                                                end: value,
                                                            },
                                                        );
                                                    } else {
                                                        blockRegion.setOptions({
                                                            ...blockRegion,
                                                            end: value,
                                                        });
                                                    }
                                                }}
                                            />
                                            <div className="p-1">
                                                <Icons.PanelRightDashed
                                                    size={16}
                                                    className="text-slate-300"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button className="group rounded p-2 hover:bg-slate-100">
                                        <Icons.LockIcon
                                            size={16}
                                            className="text-slate-300 group-hover:text-slate-500"
                                        />
                                    </button>
                                </div>
                            ) : transcript.blocks.length > 0 ? (
                                <div className="divide-y rounded-md border p-4">
                                    {transcript.blocks.map((block) => (
                                        <div
                                            key={block.id}
                                            className="grid grid-cols-2 divide-x px-2"
                                        >
                                            <span className="py-2 text-center text-xs">
                                                {block.from}
                                            </span>
                                            <span className="py-2 text-center text-xs">
                                                {block.to}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        {/* Display JSON transcript for debugging */}
                        {/* <div className="flex-shrink overflow-hidden p-4">
                            <pre className="max-h-full overflow-auto whitespace-pre-wrap rounded bg-indigo-950 px-4 py-2">
                                <code className="font-mono text-xs text-indigo-50">
                                    {JSON.stringify(transcript, null, 2)}
                                </code>
                            </pre>
                        </div> */}
                    </nav>
                </div>
            </div>
        );
    }

    // Onboarding Form
    return (
        <main className="flex h-screen flex-col">
            <header className="absolute inset-x-0 top-0 mx-auto max-w-xs p-4">
                <nav className="mx-auto flex w-max items-center space-x-1 rounded-md border bg-white/0 p-0.5 shadow-sm backdrop-blur-sm">
                    <Button variant="ghost" size="icon" className="relative">
                        <Icons.FolderOpen width={16} strokeWidth={2} />
                        <input
                            className="absolute inset-0 opacity-0"
                            type="file"
                            name="audio_files"
                            id="audio_files"
                            accept=".wav"
                            onChange={(e) => {
                                onUpload(e);
                            }}
                        />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            // TODO: reset the transcript object
                            // TODO: make sure to first open an alert box to confirm
                            // TODO: trigger a toast once done
                        }}
                    >
                        <Icons.Eraser width={16} strokeWidth={2} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            // TODO: move the export logic here
                            // this will require a global store to access the transcript object from here
                        }}
                    >
                        <Icons.HardDriveDownload width={16} strokeWidth={2} />
                    </Button>
                </nav>
            </header>
        </main>
    );
}
