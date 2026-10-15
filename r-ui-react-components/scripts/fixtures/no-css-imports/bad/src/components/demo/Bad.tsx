import "./styles.css";
import { useState } from "react";
import sheet from "./theme.css?inline";
export const lazy = () => import("./late.css");
export const Bad = () => useState(sheet)[0];
