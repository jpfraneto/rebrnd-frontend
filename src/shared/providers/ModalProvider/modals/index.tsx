// Types
import { ModalsIds } from '../types';

// Modals
import { ErrorModal } from './ErrorModal';
import { BottomAlertModal } from './BottomAlertModal';
import { ShareBrandModal } from './ShareBrandModal';
import { PerksModal } from './PerksModal';

export const modals = {
  [ModalsIds.ERROR]: ErrorModal,
  [ModalsIds.BOTTOM_ALERT]: BottomAlertModal,
  [ModalsIds.SHARE_BRAND]: ShareBrandModal,
  [ModalsIds.PERKS]: PerksModal
};

