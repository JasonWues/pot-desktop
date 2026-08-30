import { useState, useRef, useCallback } from 'react';

/**
 * `useState` plus a getter that reads the current value rather than the one
 * closed over at render time. `useConfig` needs it because its callbacks are
 * memoised with an empty dependency list.
 */
export const useGetState = <T,>(initState: T): [T, React.Dispatch<React.SetStateAction<T>>, () => T] => {
    const [state, setState] = useState(initState);
    const stateRef = useRef(state);
    stateRef.current = state;
    const getState = useCallback(() => stateRef.current, []);
    return [state, setState, getState];
};
