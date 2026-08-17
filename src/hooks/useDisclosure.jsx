import { useOverlayState } from '@heroui/react';
import { useMemo } from 'react';

/*
  HeroUI v3 renamed the disclosure hook and its methods: `useDisclosure` became
  `useOverlayState`, and `onOpen`/`onClose`/`onOpenChange` became
  `open`/`close`/`setOpen`. The behaviour is identical -- `setOpen` takes the
  same boolean `onOpenChange` did.

  The v2 names are kept here rather than at the fifteen call sites, which is the
  same reasoning as `utils/http.js` and `utils/env.js`: one place holds the old
  shape, and the code that uses it does not have to care. It also keeps the
  renamed destructurings (`onOpen: onSelectOpen` and friends) working untouched.
*/
export function useDisclosure(props) {
    const state = useOverlayState(props);
    return useMemo(
        () => ({
            isOpen: state.isOpen,
            onOpen: state.open,
            onClose: state.close,
            onOpenChange: state.setOpen,
            onToggle: state.toggle,
        }),
        [state]
    );
}
