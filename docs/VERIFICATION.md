# Проверка реализации — 27 сентября 2026

Источник требований: `Secure_Guard_Technical_Specification.pdf`, 23 страницы.
Документ различает реализованный код, воспроизводимые проверки и внешние критерии
приёмки. Это не заявление о завершённом промышленном пилоте.

## Матрица требований

| Требование | Реализация / доказательство | Граница проверки |
|---|---|---|
| FFmpeg input, sampling, reconnect | `services/edge/edge_agent/video.py`, tests + реальный decode/encode | RTSP и физическая webcam магазина ещё не подключены |
| Bounded queue / offline delivery | Frame queue, JPEG ring, SQLite WAL, retries, disk-error/backpressure tests | Длительность outage ограничена настроенной дисковой квотой |
| YOLO и tracking | YOLO11n CPU, ByteTrack camera isolation, настоящий inference smoke | COCO не содержит generic product |
| Нормализованные зоны / события | Polygon/state-machine tests; настоящий scan → transfer в synthetic video | Требуется разметка зон конкретной кассы |
| POS и matching | Universal REST/JSONL adapter, UTC, idempotency, qty capacity, late scan/void tests | Нет vendor POS и реальной выгрузки |
| Explainable risk | Rule version/weights, threshold, POS links, сохранение human review | Не обученная ML risk model, не доказательство нарушения |
| Evidence | 20s ring, pre/post MP4; настоящий private MinIO upload/signed download | При утрате старого benign clip поздняя отмена может остаться без видео |
| Persistence | Additive migrations, PostgreSQL source of record, Redis bounded stream | HA/backup restore drill отдельно от unit/integration tests |
| Review / audit / isolation | 3 labels, append-only audit, JWT/RBAC/tenant tests | External security audit не проводился |
| Dashboard | Фильтры, детали/POS, review, камеры, зоны, signed video, analytics | Build/DOM tests/HTTP проверены; браузерный просмотр не проверен |
| Monitoring | Prometheus/Grafana provisioning, FPS/queue/latency/process metrics | Нет длительного production baseline |
| ML pipeline | Split leakage checks, training/validation/export, model card/hash registry | Настоящее обучение требует датасета 2k–5k кадров |
| Scaling | Отдельные API/worker/edge, manual camera assignment, cloud deployment config | Fleet auto-update/canary/HA и 1/2/4/8 camera capacity не подтверждены |

## Автоматизированные проверки

- Backend: **34 passed** — Docker/PostgreSQL integration suite, включая миграции и сохранение legacy
  данных, отказ Redis, concurrent matching, late POS, роли, clips, retention и audit.
  Проверены также точные aliases PDF, аудит просмотра, поздняя отмена через 120s.
- Совмещённый edge/vision/training набор: **27 passed**, включая настоящий FFmpeg encode/decode, retry/cache,
  ограничение очередей, restart cleanup и валидацию dataset manifests.
  Vision API/backpressure входят в эти 27 (не считаются дважды); отдельно выполнен
  настоящий model inference без подмены detector.
- POS adapter: **4 passed**, включая конфликт ID, immutable retries, timezone
  normalization и несовпадающее подтверждение сервера.
- Frontend: **14 файлов / 30 passed**, `npm run build` и `npm run lint` прошли.
  Vite предупреждает о main chunk >500 KB; это предупреждение, не ошибка сборки.
- `git diff --check` проходит; предупреждения LF/CRLF относятся к Windows Git.

Итого **95 уникальных тестов** (34 + 27 + 4 + 30), плюс самостоятельные runtime
smoke-проверки. Первоначально сообщённое промежуточное число 105 включало повторный
учёт 10 vision-тестов; здесь указан исправленный итог.

## Настоящая модель и видео

Проверено на CPU Intel Core i7-12650H внутри Docker Desktop; одновременно работали
сборки/другие сервисы, поэтому это smoke, а не воспроизводимый capacity benchmark.

1. PyTorch YOLO11n: 5 detections (`bus`, `person`), стабильные ID на повторных кадрах,
   независимые состояния камер; первый inference 498.01 ms, прогретый 86.90 ms.
2. Synthetic video: 88 кадров, один движущийся автобус как явный test proxy;
   FFmpeg → YOLO → ByteTrack → scan/transfer события, один track на всём пути.
   Wall 26.51 s, observed 3.32 FPS при source sampling 4 FPS, median inference
   49.22 ms. Создан настоящий MP4 **12.98 s / 179345 bytes**.
3. ONNX: настоящий export opset17, graph validation, ONNX Runtime CPU,
   5 detections, stable IDs/camera isolation. Прогретый inference 172.22 ms.
   На этом smoke ONNX не дал ускорения; CPU PyTorch оставлен default.

Эти числа не измеряют mAP/event recall/false alerts магазина и не доказывают
производительность нескольких камер. Test video не содержит записи пользователя.
Smoke артефакты создаются во временном каталоге и удаляются после проверки.

```powershell
docker compose run --rm --no-deps vision python -m app.smoke
docker compose --profile edge run --rm --no-deps edge python -m edge_agent.smoke
docker compose run --rm --no-deps vision sh -c "pip install 'onnx>=1.16,<2' && python -m app.onnx_smoke"
```

`onnx` нужен только для export smoke/training; `onnxruntime` уже входит в runtime image.

## Сквозная HTTP/S3 приёмка

`docker-compose.acceptance.yml` поднимает отдельный project/database/bucket, без
рабочего `.env` и volumes. `scripts/runtime_smoke.py` отказывается работать, если
имя БД не `secureguard_acceptance`.

**Пройдено:** login; persistence store/terminal/camera; CV duplicate; автоматический
risk worker; risk-gated evidence; private S3 upload; signed download с сравнением
SHA-256 исходного видео; duplicate clip; все три review label; поздний POS с
сохранением confirmed; запрет anonymous clip; SQL analytics.
Использовался 12s FFmpeg testsrc MP4 **240596 bytes**, не камера магазина.

```powershell
docker compose -p secureguard-acceptance -f docker-compose.acceptance.yml up -d
docker compose -p secureguard-acceptance -f docker-compose.acceptance.yml exec -T backend python /qa/runtime_smoke.py --video /fixtures/smoke.mp4
```

Положите собственный **синтетический** MP4 10–20 секунд в
`tmp/acceptance/smoke.mp4` перед повтором; тестовые IDs генерируются заново.

## Рабочая локальная среда

Исходная БД сохранена в `output/backups/secureguard-before-spec-20260927.dump`
(25263 bytes, PostgreSQL custom format). Не удалялись пользовательские volumes.
Миграция существующей БД доведена до **0005_event_engine (head)**.
Порты ограничены localhost; PostgreSQL опубликован на 15432, поскольку 5432
на Windows был недоступен. Внутренний порт БД остался 5432.

API/worker/dashboard/vision/MinIO/PostgreSQL/Redis запущены локально.
Edge, Prometheus и Grafana также запущены. Финальный `scripts/local_stack_smoke.py`
прошёл: Nginx и login/API возвращают 200, anonymous events получают 401, закрытый
direct vision proxy — 404; Prometheus targets backend/edge/vision — все `up`;
Grafana отдала provisioned dashboards. Edge имеет **0 настроенных камер** и
ожидает конфигурацию: здоровый процесс не означает подключённую камеру.

```powershell
docker compose --profile edge --profile monitoring run --rm --no-deps -v "${PWD}/scripts:/qa:ro" backend python /qa/local_stack_smoke.py
```

Проверка не создаёт бизнес-события и не открывает камеры. После финальной сборки
сквозной HTTP/S3 test повторён и вновь прошёл. Тестовые окружения остановлены
отдельно от рабочих сервисов.

## Не подтверждено / что нужно для завершения пилота

1. Доступный RTSP или разрешённая запись реальной кассы, её зоны и синхронизированные часы.
2. Размеченный dataset и holdout магазины/камеры, обучение `product`, оценка качества.
3. Настоящие POS события через универсальный API/адаптер.
4. 8-часовой прогон и измерения 1/2/4/8 камер на целевом ПК; команда есть в DEPLOYMENT.
5. Визуальная проверка UI/webcam/video в браузере. Browser automation bridge текущей
   среды недоступен; DOM tests и HTTP-проверка не выданы за browser verification.
6. Railway account/project. Config-as-code подготовлен, но облачный deployment
   **не выполнялся**: доступ к браузеру/аккаунту отсутствовал.
7. Условия лицензии Ultralytics, production secrets/TLS, restore drill,
   политика хранения/доступа и операционный владелец до промышленного запуска.

Ожидаемые input и критерии следующего этапа: [ROADMAP.md](ROADMAP.md).
