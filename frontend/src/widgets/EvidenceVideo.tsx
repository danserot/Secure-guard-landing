import { Box, Button, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import {
  apiRequest,
  apiUrl,
  getAccessToken,
  setAccessToken,
} from "../api/client";

type EvidenceProps = { path: string; eventId?: string; seekSeconds?: number };

export function EvidenceVideo({ path, eventId, seekSeconds }: EvidenceProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <EvidenceVideoContent
      key={`${eventId ?? ""}:${path}:${attempt}`}
      path={path}
      eventId={eventId}
      seekSeconds={seekSeconds}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function EvidenceVideoContent({
  path,
  eventId,
  seekSeconds,
  onRetry,
}: EvidenceProps & { onRetry: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [playable, setPlayable] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && seekSeconds !== undefined)
      videoRef.current.currentTime = Math.max(0, seekSeconds);
  }, [seekSeconds]);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    if (eventId) {
      // Stream directly from private storage; only the short-lived URL passes through the API.
      void apiRequest<{ url: string; expires_in: number }>(
        `/api/v1/events/${encodeURIComponent(eventId)}/clip-url`,
        { signal: controller.signal },
      )
        .then((result) => {
          const signed = new URL(result.url);
          if (!["http:", "https:"].includes(signed.protocol))
            throw new Error("Сервер вернул некорректную ссылку на клип");
          if (!controller.signal.aborted) setUrl(signed.toString());
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted)
            setError(
              reason instanceof Error ?
                reason.message
              : "Ошибка загрузки ссылки",
            );
        });
      return () => controller.abort();
    }
    const target = new URL(apiUrl(path));
    const token = getAccessToken();
    const trusted = target.origin === new URL(apiUrl("/api/")).origin;
    if (!["http:", "https:"].includes(target.protocol)) return;
    void fetch(target, {
      signal: controller.signal,
      headers: trusted && token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        if (
          response.status === 401 &&
          trusted &&
          token &&
          getAccessToken() === token
        )
          setAccessToken(null);
        if (!response.ok)
          throw new Error(
            "Клип недоступен. Проверьте авторизацию и повторно откройте событие.",
          );
        const blob = await response.blob();
        if (!controller.signal.aborted) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : "Ошибка загрузки клипа",
          );
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, eventId]);
  if (error)
    return (
      <Box>
        <Text role="alert">{error}</Text>
        <Button size="sm" mt="3" onClick={onRetry}>
          Обновить ссылку и повторить
        </Button>
      </Box>
    );
  return url ?
      <Box>
        <Text mb="2" fontSize="sm" role="status">
          {playable ? "Клип доступен для проверки" : "Загружаем видео…"}
        </Text>
        <video
          ref={videoRef}
          controls
          playsInline
          src={url}
          style={{ width: "100%", maxHeight: 420 }}
          onLoadedData={() => setPlayable(true)}
          onLoadedMetadata={() => {
            if (videoRef.current && seekSeconds !== undefined)
              videoRef.current.currentTime = Math.max(0, seekSeconds);
          }}
          onError={() =>
            setError(
              "Не удалось воспроизвести клип. Ссылка могла истечь или формат не поддерживается.",
            )
          }
        />
      </Box>
    : <Text>Загрузка клипа…</Text>;
}
