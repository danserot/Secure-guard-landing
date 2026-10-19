import { useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, CircleHelp, Clock3, Maximize2, ReceiptText, ScanLine, Video, X } from 'lucide-react';
import { scenarios } from './content';

export function EventDemo({ compact = false }: { compact?: boolean }) {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [position, setPosition] = useState(10);
  const [decision, setDecision] = useState('');
  const scenario = scenarios[scenarioIndex];

  function selectScenario(index: number) {
    setScenarioIndex(index);
    setDecision('');
    setPosition(10);
  }

  return (
    <div className={`sg-demo ${compact ? 'sg-demo-compact' : ''}`}>
      <div className="sg-demo-top"><span><span className="sg-mini-brand">S</span> Рабочее пространство</span><span className="sg-demo-badge">Демонстрационный пример</span></div>
      <div className="sg-demo-toolbar"><span><span className="sg-status-dot" /> Событие на проверке</span><span>№ 00482 <ChevronRight size={13} /></span></div>
      {!compact && <div className="sg-demo-tabs" aria-label="Пример сценария">{scenarios.map((item, index) => <button type="button" aria-pressed={scenarioIndex === index} key={item.short} onClick={() => selectScenario(index)}>{item.short}</button>)}</div>}
      <div className="sg-demo-columns">
        <div className="sg-demo-video-column">
          <div className="sg-camera-frame">
            <img src="/checkout.jpg" alt="Иллюстрация кассовой зоны с выделенными зонами сканирования и передачи" width="1280" height="720" fetchPriority={compact ? 'high' : 'auto'} loading={compact ? 'eager' : 'lazy'} />
            <div className="sg-camera-overlay"><span><Video size={12} /> Касса 01</span><span>14:32:{String(8 + position).padStart(2, '0')}</span></div>
            <div className="sg-zone sg-zone-scan"><span>Зона сканирования</span></div>
            <div className={`sg-zone sg-zone-transfer ${scenarioIndex === 2 ? 'sg-zone-drawer' : ''}`}><span>{scenarioIndex === 2 ? 'Денежный ящик' : 'Зона передачи'}</span></div>
            <div className="sg-frame-caption">Иллюстрация · макет видеоконтекста</div>
            <span className="sg-frame-corner"><Maximize2 size={14} /></span>
          </div>
          <div className="sg-timeline">
            <div className="sg-timeline-label"><span><Clock3 size={12} /> Контекст события</span><span>−10 / +10 сек</span></div>
            <div className="sg-timeline-track"><span className="sg-timeline-event" /><span className="sg-timeline-cursor" style={{ left: `${position * 5}%` }} /></div>
            <div className="sg-timeline-times"><span>14:32:08</span><span className="sg-orange">14:32:18</span><span>14:32:28</span></div>
            {!compact && <label className="sg-scrubber">Выберите время в макете<input aria-label="Время в демонстрационном макете" type="range" min="0" max="20" value={position} onChange={(event) => setPosition(Number(event.target.value))} /><small>Схема временного окна, не реальная видеозапись.</small></label>}
          </div>
        </div>
        <div className="sg-pos-card">
          <div className="sg-pos-heading"><ReceiptText size={16} /><span>POS-контекст</span><span className="sg-soft-dot" /></div>
          <div className="sg-receipt-meta"><span>Магазин «Пример»</span><strong>Чек № 00482</strong><span>Касса 01 · {scenario.time}</span></div>
          <div className="sg-receipt-line"><span>Минеральная вода</span><span>1 шт.</span></div>
          <div className="sg-receipt-line"><span>Хлеб</span><span>1 шт.</span></div>
          <div className="sg-pos-event"><span>{scenario.pos[0]}</span><p>{scenario.pos[1]}</p></div>
          <div className="sg-pos-event"><span>{scenario.pos[2]}</span><p>{scenario.pos[3]}</p></div>
          <p className="sg-pos-footnote">Пример данных при подключённом POS</p>
        </div>
      </div>
      <div className="sg-demo-reason"><span className="sg-reason-icon"><ScanLine size={17} /></span><div><small>ПРИЧИНА ОТМЕТКИ</small><strong>{scenario.reason}</strong></div>{compact && <ArrowUpRight size={18} />}</div>
      {!compact && <>
        <p className="sg-demo-context">{scenario.note}</p>
        <div className="sg-demo-decisions" aria-label="Решение в демонстрационном примере">{[{ label: 'Подтвердить', icon: Check }, { label: 'Ложная тревога', icon: X }, { label: 'Не уверен', icon: CircleHelp }].map(({ label, icon: Icon }) => <button type="button" key={label} aria-pressed={decision === label} onClick={() => setDecision(label)}><Icon size={15} />{label}</button>)}</div>
        <p className="sg-decision-status" role="status">{decision ? `В примере выбрано: «${decision}». Рабочие данные не изменены.` : 'Попробуйте выбрать решение. Это безопасный демонстрационный пример.'}</p>
      </>}
    </div>
  );
}
