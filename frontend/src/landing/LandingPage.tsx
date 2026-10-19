import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleCheck, Menu, MoveRight, ScanLine, X } from 'lucide-react';
import { benefits, faqs, scenarios, steps } from './content';
import { EventDemo } from './EventDemo';
import { LeadForm } from './LeadForm';
import './landing.css';

const links = [['#capabilities', 'Возможности'], ['#how-it-works', 'Как работает'], ['#pilot', 'Пилот'], ['#questions', 'Вопросы']];

function Brand() {
  return <a href="/landing" className="sg-brand" aria-label="SecureGuard — главная страница"><span className="sg-brand-symbol" aria-hidden="true">S</span><span>Secure<span className="sg-brand-light">Guard</span><span className="sg-brand-period">.</span></span></a>;
}

function SectionLabel({ children, light = false }: { children: string; light?: boolean }) {
  return <p className={`sg-section-label ${light ? 'sg-label-light' : ''}`}><span />{children}</p>;
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="sg-landing">
    <a className="sg-skip-link" href="#main-content">Перейти к содержимому</a>
    <header className="sg-header">
      <div className="sg-container sg-header-inner">
        <Brand />
        <nav className="sg-desktop-nav" aria-label="Основная навигация">{links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
        <a className="sg-header-cta" href="#contact">Обсудить пилот <ArrowUpRight size={16} /></a>
        <button className="sg-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="sg-mobile-nav" aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      </div>
      {menuOpen && <nav className="sg-mobile-nav" id="sg-mobile-nav" aria-label="Мобильная навигация" onKeyDown={(event) => { if (event.key === 'Escape') { setMenuOpen(false); document.querySelector<HTMLButtonElement>('.sg-menu-toggle')?.focus(); } }}>{links.map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}<ArrowUpRight size={16} /></a>)}<a href="#contact" onClick={() => setMenuOpen(false)}>Обсудить пилот<ArrowUpRight size={16} /></a></nav>}
    </header>
    <main id="main-content">
      <section className="sg-hero sg-container" aria-labelledby="sg-hero-title">
        <div className="sg-hero-copy">
          <p className="sg-hero-eyebrow"><span className="sg-status-dot" /> ВНИМАНИЕ К СОБЫТИЯМ. УВАЖЕНИЕ К ЛЮДЯМ.</p>
          <h1 id="sg-hero-title">Спорный момент<br className="sg-wide-break" /> у кассы?<br /><span>Весь контекст</span><br />перед вами.</h1>
          <p className="sg-hero-description">Разбирайте события с видео и контекстом чека. SecureGuard собирает фрагмент, доступные данные кассы и причину отметки в одной карточке.</p>
          <div className="sg-hero-actions"><a className="sg-button sg-button-primary" href="#contact">Проверить совместимость <ArrowUpRight size={18} /></a><a className="sg-text-link" href="#demo">Как это работает <span><ArrowDown size={15} /></span></a></div>
          <p className="sg-hero-note"><CircleCheck size={15} /> Начните с одной кассы. Решение всегда за человеком.</p>
        </div>
        <div className="sg-hero-visual"><div className="sg-visual-grid" /><div className="sg-visual-caption"><span>ОТ СОБЫТИЯ К РЕШЕНИЮ</span><span>01 / ОБЗОР</span></div><EventDemo compact /><div className="sg-visual-bottom"><span><span className="sg-status-dot" /> Видео + POS + причина отметки</span><span>Одна карточка <ArrowUpRight size={14} /></span></div></div>
      </section>
      <div className="sg-principles sg-container"><div><span className="sg-principle-number">01</span><p><strong>Нужный фрагмент</strong><span>Вместо поиска по архиву</span></p></div><div><span className="sg-principle-number">02</span><p><strong>Понятная причина</strong><span>Вместо догадок о событии</span></p></div><div><span className="sg-principle-number">03</span><p><strong>Взвешенное решение</strong><span>На основе контекста, человеком</span></p></div></div>

      <section id="capabilities" className="sg-section sg-container">
        <SectionLabel>МЕНЬШЕ РУТИНЫ В КАЖДОМ РАЗБОРЕ</SectionLabel>
        <div className="sg-section-heading"><h2>Не собирайте картину<br />по частям.</h2><p>Когда возникает вопрос к операции, важны детали. Соберите их вместе и переходите к проверке.</p></div>
        <div className="sg-problem-table">{[['Найти тот самый момент', 'Отмеченный фрагмент и временная шкала'], ['Сопоставить видео с чеком', 'Доступные POS-события рядом с видео'], ['Разобраться в расхождении', 'Объяснение причины отметки'], ['Сохранить итог проверки', 'Решение оператора и история разбора']].map(([problem, solution], index) => <div className="sg-problem-row" key={problem}><span className="sg-row-number">0{index + 1}</span><span>{problem}</span><MoveRight size={22} /><strong>{solution}</strong></div>)}</div>
      </section>

      <section className="sg-demo-section" id="demo">
        <div className="sg-container">
          <div className="sg-demo-section-heading"><div><SectionLabel light>ПОСМОТРИТЕ НА ПРИМЕРЕ</SectionLabel><h2>Всё для проверки —<br /><span>в одной карточке.</span></h2></div><p>Выберите сценарий, изучите контекст и попробуйте принять решение. Так устроен разбор события в панели.</p></div>
          <div className="sg-anatomy-layout"><EventDemo /><aside className="sg-anatomy-notes"><div><span>01 / ГДЕ И КОГДА</span><h3>Точка отсчёта</h3><p>Время, магазин и касса — чтобы сразу понять, какое событие перед вами.</p></div><div><span>02 / ЧТО ПРОИЗОШЛО</span><h3>Контекст рядом</h3><p>Короткий клип, причина отметки и связанные операции при подключённом POS.</p></div><div><span>03 / КАКОЙ РЕЗУЛЬТАТ</span><h3>Решаете вы</h3><p>Подтвердите событие, отметьте ложную тревогу или сохраните «Не уверен».</p></div><p className="sg-human-note"><CircleCheck size={19} /> Итоговую оценку даёт человек.</p></aside></div>
        </div>
      </section>

      <section className="sg-section sg-container sg-scenarios">
        <SectionLabel>ПОВОДЫ ДЛЯ ПРОВЕРКИ</SectionLabel>
        <div className="sg-section-heading"><h2>Не выводы.<br />События с контекстом.</h2><p>Система выделяет ситуации, которые стоит посмотреть внимательнее. Каждая требует проверки.</p></div>
        <div className="sg-scenario-grid">{scenarios.map((scenario, index) => <article key={scenario.short}><div className="sg-scenario-top"><ScanLine size={24} strokeWidth={1.5} /><span>0{index + 1}</span></div><h3>{scenario.title}</h3><p>{scenario.description}</p><a href="#demo">Разобрать пример <ArrowUpRight size={16} /></a></article>)}</div>
        <p className="sg-section-note">Доступность сценариев зависит от качества видео, настройки зон, распознавания и полноты POS-данных. Распознавание ассортимента проверяется отдельно.</p>
      </section>

      <section id="how-it-works" className="sg-work-section"><div className="sg-container"><SectionLabel>ОТ ПОДКЛЮЧЕНИЯ К ПРОВЕРКЕ</SectionLabel><div className="sg-section-heading"><h2>Понятный процесс.<br />На каждом шаге.</h2><a className="sg-text-link" href="#contact">Обсудить вашу кассу <ArrowUpRight size={18} /></a></div><div className="sg-steps">{steps.map(([title, text], index) => <article key={title}><div className="sg-step-top"><span>0{index + 1}</span>{index < 3 && <ArrowRight size={20} />}</div><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section className="sg-section sg-container sg-benefits"><div className="sg-benefits-heading"><SectionLabel>РАБОЧИЙ ИНСТРУМЕНТ УПРАВЛЯЮЩЕГО</SectionLabel><h2>Меньше переключений.<br />Больше ясности.</h2></div><div className="sg-benefit-grid">{benefits.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={24} strokeWidth={1.5} /><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section className="sg-pilot-section" id="pilot"><div className="sg-container sg-pilot-layout"><div className="sg-pilot-copy"><SectionLabel>СНАЧАЛА — ПРОВЕРКА НА ПРАКТИКЕ</SectionLabel><h2>Начните с одной кассы<br />и <span>измерьте результат.</span></h2><p>Ограниченный пилот поможет понять, подходит ли система вашей команде и вашим процессам.</p><a className="sg-button sg-button-primary" href="#contact">Обсудить пилот <ArrowUpRight size={18} /></a><p className="sg-pilot-price">Стоимость и сроки — после проверки оборудования и объёма интеграции.</p></div><div className="sg-pilot-plan"><ol>{['Проверка совместимости', 'Согласование сценариев и критериев', 'Настройка и наблюдение', 'Совместный разбор результатов', 'Решение о дальнейшем использовании'].map((step, index) => <li key={step}><span>0{index + 1}</span>{step}{index === 4 && <Check size={18} />}</li>)}</ol><div className="sg-pilot-measure"><span>ЧТО ИЗМЕРЯЕМ НА ПИЛОТЕ</span><div>{['Пригодность клипов', 'Время проверки', 'Ложные отметки', 'Польза для управляющего'].map((item) => <span key={item}><CircleCheck size={14} />{item}</span>)}</div></div></div></div></section>

      <section className="sg-section sg-container sg-faq-layout" id="questions"><div><SectionLabel>БЕЗ НЕЯСНОСТЕЙ</SectionLabel><h2>Хорошие вопросы.<br />Прямые ответы.</h2><p>О подключении, ограничениях<br />и работе с событиями.</p></div><div className="sg-faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={19} /></summary><p>{answer}</p></details>)}</div></section>

      <section className="sg-contact-section" id="contact"><div className="sg-container sg-contact-layout"><div className="sg-contact-copy"><SectionLabel>ДАВАЙТЕ ПОСМОТРИМ ВАШУ КАССУ</SectionLabel><h2>Подойдёт ли<br />SecureGuard<br /><span>вашему магазину?</span></h2><p>Начнём с оборудования и задач. Проверим совместимость и обсудим пилот, который можно оценить по результатам.</p><div className="sg-contact-points"><span><Check size={17} /> Одна касса для старта</span><span><Check size={17} /> Заранее согласованные критерии</span><span><Check size={17} /> Решение на основе измерений</span></div><div className="sg-contact-mark" aria-hidden="true">S<span>G</span><ArrowUpRight /></div></div><LeadForm /></div></section>
    </main>
    <footer className="sg-footer sg-container"><div><Brand /><p>Каждое событие. Весь контекст.</p></div><div className="sg-footer-right"><a href="/">Вход в рабочую панель <ArrowUpRight size={14} /></a><span>© {new Date().getFullYear()} SecureGuard</span></div></footer>
  </div>;
}
