import {
  CallControls,
  CallingState,
  SpeakerLayout,
  useCall,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";
import { Loader2Icon, MessageSquareIcon, UsersIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Channel, Chat, MessageInput, MessageList, Thread, Window } from "stream-chat-react";
import BackgroundEffectsPanel from "./BackgroundEffectsPanel";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import "stream-chat-react/dist/css/v2/index.css";

function VideoCallUI({
  chatClient,
  channel,
  selectedPreference,
  onPreferenceChange,
  onSaveDefault,
  isSavingDefault,
}) {
  const navigate = useNavigate();
  const call = useCall();
  const { useCallCallingState, useParticipantCount } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participantCount = useParticipantCount();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBackgroundPanelOpen, setIsBackgroundPanelOpen] = useState(false);
  const unregisterFilterRef = useRef(null);

  useEffect(() => {
    if (!call?.camera) return undefined;

    const clearExistingFilter = async () => {
      if (!unregisterFilterRef.current) return;
      try {
        await unregisterFilterRef.current();
      } catch {
        // no-op
      } finally {
        unregisterFilterRef.current = null;
      }
    };

    const registerBackgroundFilter = async () => {
      await clearExistingFilter();

      const effectType = selectedPreference?.type || "none";
      if (effectType === "none") {
        // Ensure the SDK republishes the raw camera stream after removing a filter.
        try {
          if (call.camera.state.status === "enabled") {
            await call.camera.disable();
            await call.camera.enable();
          }
        } catch (error) {
          console.error("Failed to reset camera after removing background filter", error);
        }
        return;
      }

      const preference = selectedPreference;
      const registration = call.camera.registerFilter((inputMediaStream) => {
        const outputCanvas = document.createElement("canvas");
        const outputContext = outputCanvas.getContext("2d");
        const sourceVideo = document.createElement("video");
        const imageBackgroundUrl = preference?.value?.imageUrl || preference?.value?.thumbUrl;
        const blurStrength = preference?.value?.strength || "low";
        const blurByStrength = { low: 3, medium: 6, high: 10 };

        let frameRequestId = null;
        let segmentationInstance = null;
        let processingSegmentation = false;
        let stopRequested = false;
        let latestSegmentation = null;
        let bgImage = null;
        const personCanvas = document.createElement("canvas");
        const personContext = personCanvas.getContext("2d");

        sourceVideo.muted = true;
        sourceVideo.autoplay = true;
        sourceVideo.playsInline = true;
        sourceVideo.srcObject = inputMediaStream;

        const startRenderLoop = () => {
          const render = async () => {
            if (stopRequested || !outputContext) return;

            const vw = sourceVideo.videoWidth;
            const vh = sourceVideo.videoHeight;
            if (vw > 0 && vh > 0) {
              if (outputCanvas.width !== vw || outputCanvas.height !== vh) {
                outputCanvas.width = vw;
                outputCanvas.height = vh;
              }

              if (effectType === "blur") {
                outputContext.save();
                outputContext.filter = `blur(${blurByStrength[blurStrength] || 3}px)`;
                outputContext.drawImage(sourceVideo, 0, 0, vw, vh);
                outputContext.restore();
              } else if (effectType === "unsplash" || effectType === "upload") {
                if (segmentationInstance && !processingSegmentation) {
                  processingSegmentation = true;
                  try {
                    await segmentationInstance.send({ image: sourceVideo });
                  } catch {
                    // Fall back below.
                  } finally {
                    processingSegmentation = false;
                  }
                }

                if (!latestSegmentation) {
                  outputContext.drawImage(sourceVideo, 0, 0, vw, vh);
                } else {
                  if (!personContext) {
                    outputContext.drawImage(sourceVideo, 0, 0, vw, vh);
                    frameRequestId = requestAnimationFrame(render);
                    return;
                  }
                  personCanvas.width = vw;
                  personCanvas.height = vh;
                  personContext.clearRect(0, 0, vw, vh);
                  personContext.drawImage(latestSegmentation.image, 0, 0, vw, vh);
                  personContext.globalCompositeOperation = "destination-in";
                  personContext.drawImage(latestSegmentation.segmentationMask, 0, 0, vw, vh);
                  personContext.globalCompositeOperation = "source-over";

                  outputContext.clearRect(0, 0, vw, vh);
                  if (bgImage) {
                    outputContext.drawImage(bgImage, 0, 0, vw, vh);
                  } else {
                    outputContext.fillStyle = "#111827";
                    outputContext.fillRect(0, 0, vw, vh);
                  }
                  outputContext.drawImage(personCanvas, 0, 0, vw, vh);
                }
              } else {
                outputContext.drawImage(sourceVideo, 0, 0, vw, vh);
              }
            }

            frameRequestId = requestAnimationFrame(render);
          };
          frameRequestId = requestAnimationFrame(render);
        };

        const outputPromise = new Promise((resolve) => {
          sourceVideo.onloadedmetadata = async () => {
            try {
              await sourceVideo.play();
            } catch {
              // Ignore autoplay restrictions for hidden element.
            }

            if ((effectType === "unsplash" || effectType === "upload") && imageBackgroundUrl) {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.src = imageBackgroundUrl;
              img.onload = () => {
                bgImage = img;
              };

              segmentationInstance = new SelfieSegmentation({
                locateFile: (file) =>
                  `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
              });
              segmentationInstance.setOptions({ modelSelection: 1, selfieMode: true });
              segmentationInstance.onResults((results) => {
                latestSegmentation = results;
              });
            }

            startRenderLoop();
            const [videoTrack] = outputCanvas.captureStream(24).getVideoTracks();
            resolve(new MediaStream([videoTrack]));
          };
        });

        return {
          output: outputPromise,
          stop: () => {
            stopRequested = true;
            if (frameRequestId) {
              cancelAnimationFrame(frameRequestId);
              frameRequestId = null;
            }
            if (segmentationInstance) {
              segmentationInstance.close();
              segmentationInstance = null;
            }
            sourceVideo.pause();
            sourceVideo.srcObject = null;
          },
        };
      });

      unregisterFilterRef.current = registration.unregister;
      try {
        await registration.registered;
      } catch (error) {
        console.error("Failed to register background filter", error);
      }
    };

    registerBackgroundFilter();

    return () => {
      clearExistingFilter();
    };
  }, [call, selectedPreference]);

  if (callingState === CallingState.JOINING) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2Icon className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
          <p className="text-lg">Joining call...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-3 relative str-video">
      <div className="flex-1 flex flex-col gap-3">
        {/* Participants count badge and Chat Toggle */}
        <div className="flex items-center justify-between gap-2 bg-base-100 p-3 rounded-lg shadow">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-primary" />
            <span className="font-semibold">
              {participantCount} {participantCount === 1 ? "participant" : "participants"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBackgroundPanelOpen(!isBackgroundPanelOpen)}
              className={`btn btn-sm gap-2 ${isBackgroundPanelOpen ? "btn-primary" : "btn-ghost"}`}
            >
              Background
            </button>
            {chatClient && channel && (
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`btn btn-sm gap-2 ${isChatOpen ? "btn-primary" : "btn-ghost"}`}
                title={isChatOpen ? "Hide chat" : "Show chat"}
              >
                <MessageSquareIcon className="size-4" />
                Chat
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 bg-base-300 rounded-lg overflow-hidden relative">
          <SpeakerLayout />
        </div>

        <div className="bg-base-100 p-3 rounded-lg shadow flex justify-center">
          <CallControls onLeave={() => navigate("/dashboard")} />
        </div>
      </div>

      {/* CHAT SECTION */}
      {isBackgroundPanelOpen && (
        <div className="w-96 overflow-auto">
          <BackgroundEffectsPanel
            selectedPreference={selectedPreference}
            onSelectPreference={onPreferenceChange}
            onSaveDefault={onSaveDefault}
            isSavingDefault={isSavingDefault}
          />
        </div>
      )}

      {chatClient && channel && (
        <div
          className={`flex flex-col rounded-lg shadow overflow-hidden bg-[#272a30] transition-all duration-300 ease-in-out ${
            isChatOpen ? "w-80 opacity-100" : "w-0 opacity-0"
          }`}
        >
          {isChatOpen && (
            <>
              <div className="bg-[#1c1e22] p-3 border-b border-[#3a3d44] flex items-center justify-between">
                <h3 className="font-semibold text-white">Session Chat</h3>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Close chat"
                >
                  <XIcon className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden stream-chat-dark">
                <Chat client={chatClient} theme="str-chat__theme-dark">
                  <Channel channel={channel}>
                    <Window>
                      <MessageList />
                      <MessageInput />
                    </Window>
                    <Thread />
                  </Channel>
                </Chat>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
export default VideoCallUI;