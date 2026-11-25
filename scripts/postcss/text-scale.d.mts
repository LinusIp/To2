// Types for the text-scale PostCSS plugin (used by the unit test).
import type { PluginCreator } from "postcss";
export function scaleFontSize(value: string): string;
export function isFontSizeProp(prop: string): boolean;
declare const plugin: PluginCreator<void>;
export default plugin;
