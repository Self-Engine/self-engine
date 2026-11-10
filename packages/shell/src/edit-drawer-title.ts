import { createContext, useContext, useLayoutEffect } from "react";

export const EditDrawerTitleContext = createContext<((title: string | undefined) => void) | null>(
  null,
);

/**
 * Names the entry in the drawer's header and for assistive technology. Give it the saved name, not
 * the draft. While it is undefined, for example during loading, the title is the module's name.
 */
export function useEditDrawerTitle(title: string | undefined): void {
  const setTitle = useContext(EditDrawerTitleContext);
  if (setTitle === null) throw new Error("useEditDrawerTitle only works inside an edit drawer");
  // Before the paint, so that another entry's content never appears under the previous title.
  useLayoutEffect(() => {
    setTitle(title);
    return () => setTitle(undefined);
  }, [setTitle, title]);
}
