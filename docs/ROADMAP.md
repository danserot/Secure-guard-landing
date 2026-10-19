# Roadmap и критерии приёмки

Основа: фазы 0–8 и Definition of Done из PDF. Реализация кода не заменяет пилотные
измерения; фактически выполненные проверки записываются в `VERIFICATION.md`.

| Этап | Артефакт | Что подтверждает завершение |
|---|---|---|
| Prototype | webcam + YOLO inference | Реальный кадр, детекции, валидный API receipt |
| MVP CV | FFmpeg + ByteTrack + zones + ring/MP4 | Stream reconnect, transitions, ограниченная память, 8h soak |
| Backend | API/DB/migrations/worker/S3 | POS+CV persistence/replay/matching, signed clip, auth scope |
| Dashboard | filters/details/reviews/config | Событие видно, клип играется, label сохраняется после refresh |
| POS | Universal API + JSONL adapter | Данные настоящей кассы после получения формата/логов |
| Fine-tune | Dataset manifest, train/validate/export/model card | 2k–5k реальных кадров, holdout cameras/stores, замер качества |
| Pilot | 1/2/4/8 camera performance reports | FPS/latency/RSS/false alerts/event recall на целевом оборудовании |
| ML risk | Версионированные признаки и labels | Достаточно reviewed событий, baseline comparison и calibration |
| Scale | Fleet management, canary/rollback | Контроль владения камерами, обновления, изоляция tenants, HA |

## Обязательные внешние входные данные

1. Камера/RTSP источник и разрешённая запись для тестирования реальной сцены.
2. Зоны конкретной кассы, расположение камеры, измеренная синхронизация POS/edge.
3. POS timestamp/ID/receipt-line данные (пока выбран универсальный API).
4. Размеченные person/product кадры и независимая тестовая выборка.
5. Целевой ПК/сервер для измерений и длительного запуска.
6. Доступ к Railway project и выбранные cloud storage/домены для deployment.

## Pilot gate

Повторить сценарии: штатная продажа; передача без скана; поздний POS; две передачи
при qty=1; qty=2; разные кассы; отмена позиции; пропажа RTSP; outage cloud/Redis;
restart edge; неавторизованный доступ; подтверждение/ложное/не уверен; retention.
Проверить 10–20s clip с корректными временными метками, связь POS и track.

До накопления labels используется explainable rules. VLM может быть отдельным
optional second-pass уже отобранных событий, но не обязательным realtime этапом.
