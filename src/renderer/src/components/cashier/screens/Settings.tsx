'use client';

import { useState, useEffect } from 'react';
import { PrinterAPI } from '@/services/printer';
import { T, NavIcon } from '@/lib/theme';
import { SubHeader, SectionTitle, Btn, ToggleRow, Row } from '../shell';
import { ScreenCtx } from './types';

export function SettingsScreen({ ctx }: { ctx: ScreenCtx }) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [testing, setTesting] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      setOnline(await PrinterAPI.checkConnection());
    } catch {
      setOnline(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

  const testPrint = async () => {
    setTesting(true);
    try {
      const res = await PrinterAPI.printTest();
      if (!res.success) alert('Ошибка тестовой печати: ' + (res.error || ''));
      else alert('Тестовая печать отправлена');
    } catch {
      alert('Не удалось подключиться к Local Server');
    } finally {
      setTesting(false);
    }
  };

  // ─── Обновления приложения (Electron — window.pos.updates) ───────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const U = (typeof window !== 'undefined' ? (window as any).pos?.updates : null) || null;
  const [ver, setVer] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ust, setUst] = useState<any>({ state: 'idle' });
  useEffect(() => {
    if (!U) return;
    U.current().then((r: { version?: string }) => setVer(r?.version || '')).catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const off = U.onEvent((p: any) => setUst(p || { state: 'idle' }));
    return off;
  }, [U]);
  const uLabel = () => {
    const s = ust.state;
    if (s === 'checking') return 'Проверка обновлений…';
    if (s === 'available') return `Доступна версия ${ust.version || ''}`;
    if (s === 'downloading') return `Загрузка ${ust.percent || 0}%`;
    if (s === 'downloaded') return `Версия ${ust.version || ''} загружена`;
    if (s === 'latest') return 'Установлена последняя версия';
    if (s === 'error') return 'Ошибка: ' + String(ust.error || '').slice(0, 80);
    return '';
  };

  return (
    <div style={{ flex: 1, background: T.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SubHeader title="Настройки" onBack={() => ctx.go('orders')} />
      <div
        style={{
          flex: 1,
          padding: 22,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
        }}
      >
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'hidden',
          }}
        >
          <SectionTitle>Принтер для чеков</SectionTitle>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 15, color: T.text, lineHeight: 1.5 }}>
              Печать управляется приложением <b>Local Server</b>. Чеки оплаты и
              отчёты автоматически идут на принтер с привязанным логином{' '}
              <b>КАССИРА</b>, кухонные чеки — на принтер повара. Выбирать принтер
              здесь не нужно.
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                background: T.panel,
                border: `2px solid ${online ? T.cta : T.border}`,
              }}
            >
              <NavIcon kind="printer" color={online ? T.cta : T.textMuted} />
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                {online === null
                  ? 'Проверка Local Server…'
                  : online
                    ? 'Local Server подключён'
                    : 'Local Server не найден'}
              </div>
            </div>
            {online === false && (
              <div style={{ color: T.textMuted, fontSize: 14 }}>
                Откройте приложение Local Server и настройте принтеры с логинами
                (раздел «Принтеры»).
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={check} fullWidth height={56} disabled={checking}>
              <NavIcon kind="settings" /> {checking ? 'Проверка…' : 'Проверить'}
            </Btn>
            <Btn onClick={testPrint} fullWidth height={56} disabled={testing || online === false}>
              <NavIcon kind="printer" /> {testing ? 'Печать…' : 'Тест печати'}
            </Btn>
          </div>

          {U && (
            <>
              <SectionTitle style={{ marginTop: 12 }}>Обновления</SectionTitle>
              <Row label="Текущая версия" value={ver || '—'} />
              {uLabel() && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: ust.state === 'error' ? T.cancelledBg : T.panelStrong,
                    color: ust.state === 'error' ? T.cancelled : T.text,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {uLabel()}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Btn onClick={() => U.check()} fullWidth height={52}>
                  <NavIcon kind="settings" /> Проверить обновления
                </Btn>
                {ust.state === 'available' && (
                  <Btn onClick={() => U.download()} fullWidth height={52}>
                    Скачать
                  </Btn>
                )}
                {ust.state === 'downloaded' && (
                  <Btn onClick={() => U.install()} fullWidth height={52}>
                    Установить и перезапустить
                  </Btn>
                )}
              </div>
            </>
          )}
        </div>

        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            overflow: 'hidden',
          }}
        >
          <SectionTitle>Уведомления</SectionTitle>
          <ToggleRow label="Звук нового заказа" storageKey="snd-new-order" defaultOn />
          <ToggleRow label="Звук готовности блюд" storageKey="snd-ready" defaultOn />
          <ToggleRow label="Звук запроса чека от официанта" storageKey="snd-check" defaultOn />
          <ToggleRow label="Автопечать чека при запросе официанта" storageKey="autoprint-check" defaultOn />

          <SectionTitle style={{ marginTop: 12 }}>Профиль</SectionTitle>
          <Row label="Кассир" value={ctx.user?.name || '-'} />
          <Row label="Телефон" value={ctx.user?.phone || '-'} />
          <Row label="Ресторан" value={ctx.restaurant?.name || '-'} />
          <Row label="Филиал" value={ctx.branch?.name || '-'} />

          <button
            onClick={() => {
              if (confirm('Выйти из системы?')) ctx.onLogout();
            }}
            style={{
              marginTop: 18,
              height: 56,
              background: T.cancelledBg,
              color: T.cancelled,
              border: `2px solid ${T.cancelled}`,
              fontFamily: T.font,
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <NavIcon kind="logout" color={T.cancelled} /> Выйти из системы
          </button>
        </div>
      </div>
    </div>
  );
}
