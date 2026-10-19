import { Button, Flex, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { useRuntimeConfig } from "../../api/runtime";
import {
  ClipRecorder,
  type RecordedEvent,
} from "../../lib/vision/clipRecorder";

export function WebcamEvidence({
  stream,
  active,
  paused,
}: {
  stream: MediaStream | null;
  active: boolean;
  paused: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<RecordedEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const recorder = useRef<ClipRecorder | null>(null);
  const blocked = useRef(false);
  const runtime = useRuntimeConfig();
  const client = useQueryClient();

  useEffect(() => {
    if (!enabled || !stream || paused) return;
    blocked.current = false;
    const instance = new ClipRecorder(
      stream,
      (event) => {
        blocked.current = true;
        setPending(event);
        setMessage("Клип готов к сохранению. Проверьте и сохраните событие.");
      },
      setMessage,
    );
    recorder.current = instance;
    return () => {
      instance.stop();
      recorder.current = null;
    };
  }, [enabled, stream, paused]);

  useEffect(() => {
    if (
      active &&
      !pending &&
      !blocked.current &&
      recorder.current?.mark("zone_activity")
    ) {
      // Do not claim an incident until the operator saves the recorded clip.
      blocked.current = true;
    }
  }, [active, pending]);

  async function save() {
    if (!pending || busy) return;
    setBusy(true);
    const form = new FormData();
    form.set("request_id", pending.id);
    form.set("occurred_at", pending.occurredAt);
    form.set("clip_started_at", pending.startedAt);
    form.set("clip_ended_at", pending.endedAt);
    form.set("reason", pending.reason);
    form.set("clip", pending.clip, "evidence.webm");
    try {
      await apiRequest("/api/webcam-events", { method: "POST", body: form });
      setPending(null);
      blocked.current = false;
      setMessage(
        "Событие и клип сохранены. Просмотрите клип в Центре проверки.",
      );
      await client.invalidateQueries({ queryKey: ["incidents"] });
    } catch (error) {
      setMessage(
        error instanceof Error ?
          error.message
        : "Ошибка сохранения. Повторите с тем же клипом.",
      );
    } finally {
      setBusy(false);
    }
  }

  const supported =
    typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported("video/webm");
  return (
    <Flex p="4" gap="3" wrap="wrap" align="center">
      <Button
        size="sm"
        disabled={!supported || !runtime.isSuccess || runtime.data.demoMode}
        onClick={() => setEnabled(!enabled)}>
        {enabled ? "Остановить запись событий" : "Включить запись событий"}
      </Button>
      <Button
        size="sm"
        disabled={!enabled || paused || !!pending || busy}
        onClick={() => {
          if (!blocked.current && recorder.current?.mark("manual")) {
            blocked.current = true;
            setMessage("Записываем ещё 3 секунды…");
          }
        }}>
        Отметить событие
      </Button>
      {pending && (
        <>
          <Button size="sm" loading={busy} onClick={() => void save()}>
            Сохранить событие с клипом
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              setPending(null);
              blocked.current = false;
              setMessage("Клип удалён из памяти браузера");
            }}>
            Отбросить
          </Button>
        </>
      )}
      <Text fontSize="sm" role="status">
        {message ||
          (supported ?
            "Запись без звука: до 10 с до отметки и 3 с после. Рука в зоне создаёт кандидат; решение принимает человек."
          : "Браузер не поддерживает запись WebM")}
      </Text>
    </Flex>
  );
}
