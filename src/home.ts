// The home page only needs the stylesheet — and, on a browser that cannot file
// into a folder, the warning that says so.

import './style.css';
import { required } from './dom';
import { supportsFolders } from './folder-access';

if (!supportsFolders()) required('browser-warning', HTMLDivElement).hidden = false;
