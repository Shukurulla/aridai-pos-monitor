'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { PrinterAPI } from '@/services/printer';
import { Order, DailySummary, PaymentType, PaymentSplit, PartialPaymentResult, Shift } from '@/types';
import { T } from '@/lib/theme';
import { Header, SideNav, Screen } from './shell';
import { Numpad } from './Numpad';
import { ScreenCtx } from './screens/types';
import { ShiftOpenScreen } from './screens/ShiftOpen';
import { ShiftCloseScreen } from './screens/ShiftClose';
import { DashboardScreen } from './screens/Dashboard';
import { OrderDetailScreen } from './screens/OrderDetail';
import { PaymentScreen } from './screens/Payment';
import { AddItemsScreen, SaboyScreen, NewOrderScreen } from './screens/Menu';
import { ReportsScreen } from './screens/Reports';
import { SettingsScreen } from './screens/Settings';
import { ExpensesScreen } from './screens/Expenses';
import { AdvancesScreen } from './screens/Advances';

// Realtime socket — online'da to'g'ridan-to'g'ri VPS'ga (CSP wss ruxsat
// bergan). Offline'da ulanmaydi (socket o'zi xato bermay turadi).
const API_URL =
  (typeof window !== 'undefined' &&
    (window as unknown as { __API_BASE__?: string }).__API_BASE__) ||
  'https://kz.kepket.uz';

const EMPTY_SUMMARY: DailySummary = {
  totalRevenue: 0,
  totalOrders: 0,
  cashRevenue: 0,
  cardRevenue: 0,
  clickRevenue: 0,
  activeOrders: 0,
  paidOrders: 0,
  cashExpenses: 0,
  clickExpenses: 0,
  availableCash: 0,
  availableClick: 0,
};

// Чек оплаты: собирает данные из заказа и печатает через Local Server.
// silent=true — авто-печать после оплаты (без alert при отсутствии блюд).
async function printOrderReceipt(order: Order, restaurantName: string, silent: boolean) {
  const isFullyPaid = order.paymentStatus === 'paid';
  const itemsForPrint = order.items.filter((item) => {
    if (item.status === 'cancelled' || item.isCancelled) return false;
    if (item.isDeleted) return false;
    if (isFullyPaid) return true;
    return item.isPaid !== true;
  });
  if (itemsForPrint.length === 0) {
    if (!silent) alert('Нет блюд для печати — все позиции уже оплачены или отменены.');
    return;
  }
  const printSubtotal = itemsForPrint.reduce((s, i) => s + i.price * i.quantity, 0);
  let hourlyCharge = 0;
  let hourlyHours = 0;
  if (!isFullyPaid && order.hasHourlyCharge && order.hourlyChargeAmount && order.hourlyChargeAmount > 0) {
    const diffH = (Date.now() - new Date(order.createdAt).getTime()) / 3600000;
    hourlyHours = Math.floor(diffH) + 1;
    hourlyCharge = hourlyHours * order.hourlyChargeAmount;
  } else if (isFullyPaid) {
    hourlyCharge = order.hourlyCharge || 0;
    hourlyHours = order.hourlyChargeHours || 0;
  }
  try {
    const result = await PrinterAPI.printPayment({
      orderId: order._id,
      orderNumber: order.orderNumber,
      tableName: order.tableName,
      waiterName: order.waiter.name,
      items: itemsForPrint.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
      subtotal: printSubtotal,
      serviceFee: 0,
      hourlyCharge: hourlyCharge > 0 ? hourlyCharge : undefined,
      hourlyHours: hourlyHours > 0 ? hourlyHours : undefined,
      total: printSubtotal + hourlyCharge,
      paymentType: order.paymentType || 'cash',
      restaurantName: restaurantName || 'Ресторан',
      date: new Date().toLocaleString('ru-RU'),
      // To'langan bo'lsa — to'lov cheki; bo'lmasa — prechek. Imzo
      // farqlansin (prechekdan keyin to'lov cheki o'tkazib yuborilmasin).
      docType: isFullyPaid ? 'payment' : 'precheck',
    });
    if (!result.success && !silent) {
      alert('Ошибка печати чека: ' + (result.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Ошибка печати чека:', error);
    if (!silent) alert('Произошла ошибка при печати чека');
  }
}

export function CashierApp() {
  const { user, restaurant, branch, logout } = useAuth();
  const [numpadOpen, setNumpadOpen] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<DailySummary>(EMPTY_SUMMARY);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  // Oxirgi ma'lum smena _id — loadData (useCallback []) yangi state'ni
  // ko'rmaydi. Online VPS /orders/today shiftId SIZ BO'SH qaytaradi, shuning
  // uchun shiftId aniqlanmasa shu zaxiradan olamiz (ekran bo'shab qolmasin).
  const lastShiftIdRef = useRef<string | undefined>(undefined);
  const [shiftLoaded, setShiftLoaded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const [screen, setScreenState] = useState<Screen>('orders');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);

  const [audio] = useState(() => {
    if (typeof window !== 'undefined') {
      const a = new Audio();
      a.src = '/notification.mp3';
      return a;
    }
    return null;
  });

  const ordersRef = useRef<Order[]>([]);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Дедуп авто-печати прчека: один и тот же запрос (reconnect/повтор события)
  // не печатается дважды в течение окна.
  const printedChecksRef = useRef<Map<string, number>>(new Map());

  // Restore persisted screen + current order
  useEffect(() => {
    try {
      const s = localStorage.getItem('kassir-screen') as Screen | null;
      if (s) setScreenState(s);
      const oid = localStorage.getItem('kassir-current-order');
      if (oid) setCurrentOrderId(oid);
    } catch {
      /* ignore */
    }
  }, []);

  const setScreen = useCallback((s: Screen) => {
    setScreenState(s);
    try {
      localStorage.setItem('kassir-screen', s);
    } catch {
      /* ignore */
    }
  }, []);
  const go = setScreen;

  useEffect(() => {
    try {
      if (currentOrderId) localStorage.setItem('kassir-current-order', currentOrderId);
      else localStorage.removeItem('kassir-current-order');
    } catch {
      /* ignore */
    }
  }, [currentOrderId]);

  const loadData = useCallback(async (shiftId?: string) => {
    try {
      let currentShiftId = shiftId;
      if (!currentShiftId) {
        // Smena offline'da xato bersa ham TO'XTAMAYMIZ — orderlar baribir
        // yuklanishi shart (avval bu throw bo'lsa setOrders chaqirilmasdi).
        try {
          const shiftData = await api.getActiveShift();
          currentShiftId = shiftData?._id;
          if (shiftData) setActiveShift(shiftData);
        } catch (e) {
          console.warn('[loadData] getActiveShift xato (offline?), davom etamiz:', e);
        } finally {
          setShiftLoaded(true);
        }
      }
      // Zaxira: smena aniqlanmasa oxirgi ma'lumdan olamiz. Online'da
      // shiftId SIZ /orders/today BO'SH qaytaradi → yangi zakaz "ekranda
      // ko'rinmaydi" bo'lardi. Aniqlangan smenani ref'ga saqlaymiz.
      if (!currentShiftId) currentShiftId = lastShiftIdRef.current;
      if (currentShiftId) lastShiftIdRef.current = currentShiftId;
      // ENG MUHIM: orderlar. Avval Promise.all edi — getDailySummary
      // (/api/reports/dashboard offline handleri YO'Q → 503) reject bo'lsa
      // setOrders UMUMAN chaqirilmasdi va offline yaratilgan order
      // (jumladan saboy) ekranda chiqmasdi. Endi orderlarni alohida,
      // birinchi navbatda o'rnatamiz; summary/tables — best-effort.
      const ordersData = await api.getOrders(currentShiftId);
      // Smena aniqlanmay BO'SH kelsa, oldingi ro'yxatni o'chirmaymiz
      // (online'da ekran kutilmaganda bo'shab qolmasin).
      setOrders((prev) =>
        Array.isArray(ordersData) && (ordersData.length > 0 || currentShiftId || prev.length === 0)
          ? ordersData
          : prev,
      );
      // Summary — ikkilamchi: xato bersa ham orderlarga ta'sir qilmaydi.
      api
        .getDailySummary(currentShiftId)
        .then((s) => setSummary(s))
        .catch((e) => console.warn('[loadData] getDailySummary xato (offline?):', e));
      // Stol nomlari keshini issitamiz (Dashboard'da "Неизвестный стол"
      // chiqmasligi uchun) — natijasi/xatosi muhim emas.
      api.getTables().catch(() => []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setShiftLoaded(true);
    }
  }, []);

  // Socket connection (ported from original Dashboard)
  useEffect(() => {
    const token = api.getToken();
    if (!token || !user?.restaurantId) return;

    const socket: Socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('cashier_connect', { cashierId: user._id, restaurantId: user.restaurantId });
    });
    socket.on('disconnect', () => setIsConnected(false));

    const refresh = () => loadData();
    const refreshSound = () => {
      loadData();
      audio?.play().catch(() => {});
    };

    // Бэкенд при создании заказа официантом шлёт 'new_order' (роль cashier)
    // и 'order:created' (комната ресторана) — раньше их НЕ слушали, поэтому
    // новые заказы не появлялись в реальном времени.
    socket.on('new_order', refreshSound);
    socket.on('new_order_for_cashier', refreshSound);
    socket.on('new_kitchen_order', refreshSound);
    socket.on('order_updated', refresh);
    socket.on('kitchen_orders_updated', refresh);
    socket.on('order_paid', refresh);
    socket.on('order_paid_success', refresh);
    socket.on('item_status_updated', refresh);
    socket.on('food_status_changed', refresh);
    socket.on('order_completed', refresh);
    socket.on('order_deleted', refresh);
    socket.on('order_item_deleted', refresh);
    socket.on('order_rejected', refresh);
    socket.on('order_cancelled', refresh);
    socket.on('order_item_cancelled', refresh);
    // Комнатные (broadcast на весь ресторан) — на случай, если роль-комната
    // не совпала; гарантирует real-time у кассы.
    socket.on('order:created', refreshSound);
    socket.on('order:updated', refresh);
    socket.on('order:deleted', refresh);
    socket.on('order:cancelled', refresh);
    socket.on('order:paid', refresh);

    socket.on('shift:opened', (data) => {
      setActiveShift(data.shift);
      setShiftLoaded(true);
      loadData(data.shift?._id);
    });
    socket.on('shift:closed', () => {
      setActiveShift(null);
      setShiftLoaded(true);
      setOrders([]);
      setSummary(EMPTY_SUMMARY);
    });
    socket.on('shift:updated', (data) => {
      if (data.shift) setActiveShift(data.shift);
    });

    // Auto-print pre-check from waiter (gated by Settings toggle)
    socket.on('print_check_requested', async (data) => {
      audio?.play().catch(() => {});
      if (typeof window !== 'undefined' && localStorage.getItem('autoprint-check') === '0') return;

      // Дедуп: тот же запрос (reconnect / повторный emit / несколько
      // слушателей) не печатается повторно в течение 25 секунд.
      const dedupKey = String(
        data.requestId || data.checkId || `${data.orderId}:${data.requestedAt || ''}`,
      );
      const now = Date.now();
      const seen = printedChecksRef.current;
      const last = seen.get(dedupKey);
      if (last && now - last < 25000) return;
      seen.set(dedupKey, now);
      for (const [k, ts] of seen) if (now - ts > 300000) seen.delete(k);

      const localOrder = ordersRef.current.find((o) => o._id === data.orderId);
      let itemsForPrint: { name: string; quantity: number; price: number }[];
      let subtotal: number;
      let hourlyCharge = 0;
      let hourlyHours = 0;

      if (localOrder) {
        const unpaidItems = localOrder.items.filter(
          (i) => i.status !== 'cancelled' && !i.isCancelled && !i.isDeleted && i.isPaid !== true,
        );
        if (unpaidItems.length === 0) return;
        itemsForPrint = unpaidItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price }));
        subtotal = unpaidItems.reduce((s, i) => s + i.price * i.quantity, 0);
        if (localOrder.hasHourlyCharge && localOrder.hourlyChargeAmount && localOrder.hourlyChargeAmount > 0) {
          const diffH = (Date.now() - new Date(localOrder.createdAt).getTime()) / 3600000;
          hourlyHours = Math.floor(diffH) + 1;
          hourlyCharge = hourlyHours * localOrder.hourlyChargeAmount;
        }
      } else {
        itemsForPrint = data.items || [];
        subtotal = data.subtotal || 0;
        if (data.hasHourlyCharge && data.hourlyChargeAmount && data.hourlyChargeAmount > 0) {
          const diffH =
            (Date.now() - new Date(data.requestedAt || new Date().toISOString()).getTime()) / 3600000;
          hourlyHours = Math.floor(diffH) + 1;
          hourlyCharge = hourlyHours * data.hourlyChargeAmount;
        }
      }

      try {
        await PrinterAPI.printPayment(
          {
            orderId: data.orderId,
            orderNumber: data.orderNumber || 0,
            tableName: data.tableName || 'Неизвестный стол',
            waiterName: data.waiterName || '',
            items: itemsForPrint,
            subtotal,
            serviceFee: 0,
            hourlyCharge: hourlyCharge > 0 ? hourlyCharge : undefined,
            hourlyHours: hourlyHours > 0 ? hourlyHours : undefined,
            total: subtotal + hourlyCharge,
            paymentType: 'cash',
            restaurantName: restaurant?.name || 'Ресторан',
            date: new Date().toLocaleString('ru-RU'),
            docType: 'precheck',
          },
        );
      } catch (err) {
        console.error('Auto-print error:', err);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user?._id, user?.restaurantId, audio, loadData, restaurant?.name]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Офлайн-изменения НЕ приходят через socket.io VPS (их там ещё нет).
  // Поэтому: (1) перечитываем при возврате online (mode:changed из main),
  // (2) страховочный опрос каждые 10с — экраны сами обновляются и офлайн
  // (локальная база), и сразу после восстановления связи.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = typeof window !== 'undefined' ? (window as any).pos : null;
    let t: ReturnType<typeof setTimeout> | undefined;
    let off: (() => void) | undefined;
    try {
      off = w?.mode?.onChange?.((mode: string) => {
        if (mode === 'online') {
          if (t) clearTimeout(t);
          t = setTimeout(() => loadData(), 1500); // local-server flushOutbox
        }
      });
    } catch {
      /* ignore */
    }
    const poll = setInterval(() => loadData(), 10000);
    return () => {
      if (off) off();
      if (t) clearTimeout(t);
      clearInterval(poll);
    };
  }, [loadData]);

  // ─── Handlers (ported) ─────────────────────────────────────────────────────
  const handlePayment = useCallback(
    async (orderId: string, paymentType: PaymentType, paymentSplit?: PaymentSplit, comment?: string) => {
      try {
        const paidOrder = await api.processPayment(orderId, paymentType, paymentSplit, comment);
        setOrders((prev) => prev.map((o) => (o._id === orderId ? paidOrder : o)));
        // Оплачено → автоматически печатаем чек (Local Server направит на кассу)
        printOrderReceipt(paidOrder, restaurant?.name || 'Ресторан', true);
        await loadData();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Оплата не выполнена';
        // Заказ фактически уже оплачен (двойной клик / устаревший экран) —
        // это не ошибка: обновляем список и выходим без alert.
        if (/уже оплач|already paid/i.test(msg)) {
          await loadData();
          return;
        }
        alert(msg);
        throw error;
      }
    },
    [loadData, restaurant?.name],
  );

  const handlePartialPayment = useCallback(
    async (
      orderId: string,
      itemIds: string[],
      paymentType: PaymentType,
      paymentSplit?: PaymentSplit,
      comment?: string,
    ): Promise<PartialPaymentResult> => {
      try {
        const result = await api.processPartialPayment(orderId, itemIds, paymentType, paymentSplit, comment);
        setOrders((prev) => prev.map((o) => (o._id === orderId ? result.order : o)));
        // Частичная оплата → печатаем чек ТОЛЬКО на оплаченные позиции
        const ps = result.paymentSession;
        const o = result.order;
        if (ps && Array.isArray(ps.paidItems) && ps.paidItems.length > 0) {
          const sub = ps.paidItems.reduce((s, i) => s + i.price * i.quantity, 0);
          PrinterAPI.printPayment({
            orderId: o._id,
            orderNumber: o.orderNumber,
            tableName: o.tableName,
            waiterName: o.waiter.name,
            items: ps.paidItems.map((i) => ({ name: i.foodName, quantity: i.quantity, price: i.price })),
            subtotal: ps.subtotal || sub,
            serviceFee: 0,
            total: ps.total || sub,
            paymentType: ps.paymentType || paymentType,
            restaurantName: restaurant?.name || 'Ресторан',
            date: new Date().toLocaleString('ru-RU'),
            docType: 'partial',
          }).catch((e) => console.error('Partial receipt print error:', e));
        }
        await loadData();
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Оплата не выполнена';
        alert(msg);
        throw error;
      }
    },
    [loadData, restaurant?.name],
  );

  const handlePrint = useCallback(
    async (order: Order) => {
      await printOrderReceipt(order, restaurant?.name || 'Ресторан', false);
    },
    [restaurant?.name],
  );

  const handleAddItemsSuccess = useCallback(
    (updated: Order) => {
      setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
      loadData();
    },
    [loadData],
  );

  // Yangi zakaz yaratilganda — backend response'dagi to'liq order'ni darhol
  // local state'ga qo'shamiz. Avval `await ctx.reload()` chaqirilardi, lekin
  // Mongo replica eventual consistency / race tufayli yangi order Dashboard'da
  // ko'rinmasdi (povorga check ketgani holda). Endi: optimistic qo'shamiz,
  // keyin loadData() sync uchun.
  const handleOrderCreated = useCallback(
    (newOrder: Order) => {
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o._id === newOrder._id);
        if (idx === -1) return [newOrder, ...prev];
        // Allaqachon mavjud bo'lsa (mas. mavjud orderga item qo'shildi) —
        // yangilangan obyektga almashtiramiz, dublikat qilmaymiz.
        const next = prev.slice();
        next[idx] = newOrder;
        return next;
      });
      // Backend bilan to'liq sync uchun fon rejimda yangilash. Race'dan keyin
      // ham yangi order yo'qolmaydi (yuqoridagi setOrders'da allaqachon bor).
      loadData();
    },
    [loadData],
  );

  const handleChangeItemQty = useCallback(
    async (orderId: string, itemId: string, quantity: number) => {
      try {
        await api.updateItemQuantity(orderId, itemId, quantity);
        await loadData();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Не удалось изменить количество';
        alert(msg);
        throw error;
      }
    },
    [loadData],
  );

  const currentOrder = useMemo(
    () => orders.find((o) => o._id === currentOrderId) || null,
    [orders, currentOrderId],
  );

  // Header tushumi — kassir ko'rayotgan paid orderlardan, to'lov turi bo'yicha.
  // (opening kassa / avans / rasxod ARALASHMAYDI — faqat kunlik tushum.
  //  cash+card+перевод === Выручка bo'lib, ichki izchil.)
  const headerSummary = useMemo(() => {
    let total = 0;
    let cash = 0;
    let card = 0;
    let click = 0;
    for (const o of orders) {
      if (o.paymentStatus !== 'paid') continue;
      const amt =
        o.grandTotal ||
        (o.items || [])
          .filter((i) => i.status !== 'cancelled' && !i.isCancelled)
          .reduce((s, i) => s + i.price * i.quantity, 0);
      total += amt;
      const sp = o.paymentSplit;
      if (o.paymentType === 'mixed' && sp) {
        cash += sp.cash || 0;
        card += sp.card || 0;
        click += sp.click || 0;
      } else if (o.paymentType === 'card') {
        card += amt;
      } else if (o.paymentType === 'click') {
        click += amt;
      } else {
        cash += amt;
      }
    }
    // Сервер (api.getDailySummary) — источник истины за смену: он считает все
    // оплаченные заказы, а не только активные, что лежат сейчас в памяти.
    // Локальный пересчёт берём ТОЛЬКО когда сервер ещё отдал 0 (самый первый
    // оплаченный заказ до рефреша) — иначе шапка показывала 0 при реальной выручке.
    const serverTotal = summary.totalRevenue || 0;
    if (serverTotal > 0) return summary;
    return {
      ...summary,
      totalRevenue: total,
      cashRevenue: cash,
      cardRevenue: card,
      clickRevenue: click,
    };
  }, [orders, summary]);

  const ctx: ScreenCtx = {
    go,
    screen,
    orders,
    summary,
    activeShift,
    user,
    restaurant,
    branch,
    isConnected,
    currentOrder,
    setCurrentOrderId,
    mergeSelection,
    setMergeSelection,
    reload: loadData,
    onPay: handlePayment,
    onPartialPay: handlePartialPayment,
    onPrint: handlePrint,
    onAddItemsSuccess: handleAddItemsSuccess,
    onOrderCreated: handleOrderCreated,
    onChangeItemQty: handleChangeItemQty,
    onShiftChanged: (s) => {
      setActiveShift(s);
      setShiftLoaded(true);
    },
    onLogout: logout,
  };

  // No active shift → force shift-open (full screen, no chrome)
  if (shiftLoaded && !activeShift) {
    return <ShiftOpenScreen ctx={ctx} />;
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: T.font }}>
      <Header
        summary={headerSummary}
        activeShift={activeShift}
        user={user}
        restaurant={restaurant}
        branch={branch}
        isConnected={isConnected}
        numpadOpen={numpadOpen}
        onToggleNumpad={() => setNumpadOpen((v) => !v)}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'auto', minHeight: 0 }}>
        <SideNav current={screen} go={go} />
        {screen === 'orders' && <DashboardScreen ctx={ctx} />}
        {screen === 'merge' && <DashboardScreen ctx={ctx} />}
        {screen === 'orderDetail' && <OrderDetailScreen ctx={ctx} />}
        {screen === 'payment' && <PaymentScreen ctx={ctx} />}
        {screen === 'addItems' && <AddItemsScreen ctx={ctx} />}
        {screen === 'newOrder' && <NewOrderScreen ctx={ctx} />}
        {(screen === 'saboy' || screen === 'menu') && <SaboyScreen ctx={ctx} />}
        {screen === 'reports' && <ReportsScreen ctx={ctx} />}
        {screen === 'expenses' && <ExpensesScreen ctx={ctx} />}
        {screen === 'advances' && <AdvancesScreen ctx={ctx} />}
        {screen === 'settings' && <SettingsScreen ctx={ctx} />}
        {screen === 'shiftClose' && <ShiftCloseScreen ctx={ctx} />}
      </div>
      <Numpad open={numpadOpen} onClose={() => setNumpadOpen(false)} />
    </div>
  );
}
