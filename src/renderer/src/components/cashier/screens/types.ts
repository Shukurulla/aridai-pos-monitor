import { Order, DailySummary, Shift, PaymentType, PaymentSplit, PartialPaymentResult, User, Restaurant, Branch } from '@/types';
import { Screen } from '../shell';

export interface ScreenCtx {
  go: (s: Screen) => void;
  screen: Screen;
  orders: Order[];
  summary: DailySummary;
  activeShift: Shift | null;
  user: User | null;
  restaurant: Restaurant | null;
  branch: Branch | null;
  isConnected: boolean;

  // Current order context (detail / payment / addItems)
  currentOrder: Order | null;
  setCurrentOrderId: (id: string | null) => void;

  // Merge mode
  mergeSelection: string[];
  setMergeSelection: (ids: string[]) => void;

  // Data + actions
  reload: () => Promise<void>;
  onPay: (
    orderId: string,
    paymentType: PaymentType,
    paymentSplit?: PaymentSplit,
    comment?: string,
  ) => Promise<void>;
  onPartialPay: (
    orderId: string,
    itemIds: string[],
    paymentType: PaymentType,
    paymentSplit?: PaymentSplit,
    comment?: string,
  ) => Promise<PartialPaymentResult>;
  onPrint: (order: Order) => Promise<void> | void;
  onAddItemsSuccess: (order: Order) => void;
  onShiftChanged: (shift: Shift | null) => void;
  onChangeItemQty: (orderId: string, itemId: string, quantity: number) => Promise<void>;
  onLogout: () => void;
}
