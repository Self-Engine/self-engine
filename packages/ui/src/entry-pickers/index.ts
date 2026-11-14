// The pickers of an entry's mark and color (D291, D299), for a module's edit form. Their own
// entry of `ui`, because the icon field imports the directory of 107 pictures, which never loads
// at startup (D293): an edit drawer, which loads on demand, imports them. The field's Emoji tab
// loads Mantine's emoji picker and its data only when it first opens (D300).

export { EntryColorPicker, type EntryColorPickerProps } from "./entry-color-picker.tsx";
export { EntryIconPicker, type EntryIconPickerProps } from "./entry-icon-picker.tsx";
