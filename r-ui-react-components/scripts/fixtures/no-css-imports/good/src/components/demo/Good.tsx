// import "./styles.css" in a comment is prose, not an import.
import { useState } from "react";
export const SHEET_NAME = "styles.css";
export const Good = () => useState(SHEET_NAME)[0];
