import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NavigationFocusState {
  articleIdToOpen: number | null;
  commentIdToHighlight: number | null;
  sourceScreen?: string; // Optional: to know where the request originated, e.g., 'profile'
  setNavigationFocus: (
    articleId: number | null, 
    commentId: number | null,
    source?: string
  ) => void;
  clearNavigationFocus: () => void;
}

const NavigationFocusContext = createContext<NavigationFocusState | undefined>(undefined);

export const NavigationFocusProvider = ({ children }: { children: ReactNode }) => {
  const [articleIdToOpen, setArticleIdToOpen] = useState<number | null>(null);
  const [commentIdToHighlight, setCommentIdToHighlight] = useState<number | null>(null);
  const [sourceScreen, setSourceScreen] = useState<string | undefined>(undefined);

  const setNavigationFocus = (
    articleId: number | null, 
    commentId: number | null,
    source?: string
  ) => {
    setArticleIdToOpen(articleId);
    setCommentIdToHighlight(commentId);
    setSourceScreen(source);
  };

  const clearNavigationFocus = () => {
    setArticleIdToOpen(null);
    setCommentIdToHighlight(null);
    setSourceScreen(undefined);
  };

  return (
    <NavigationFocusContext.Provider 
      value={{ 
        articleIdToOpen, 
        commentIdToHighlight, 
        sourceScreen,
        setNavigationFocus, 
        clearNavigationFocus 
      }}
    >
      {children}
    </NavigationFocusContext.Provider>
  );
};

export const useNavigationFocus = () => {
  const context = useContext(NavigationFocusContext);
  if (context === undefined) {
    throw new Error('useNavigationFocus must be used within a NavigationFocusProvider');
  }
  return context;
}; 