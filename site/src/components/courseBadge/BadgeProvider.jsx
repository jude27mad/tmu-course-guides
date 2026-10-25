import { createContext, useContext } from 'react';

const BadgeContext = createContext(null);
export const BadgeProvider = BadgeContext.Provider;
export const useBadgeRegistry = () => useContext(BadgeContext);
