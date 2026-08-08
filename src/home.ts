// The home page shows one real label, built by the code that prints them, so
// what she is promised and what comes out of the printer cannot drift apart. A
// browser that cannot file into a folder is told so on the photos page, where
// it changes what the buttons do.

import './fonts';
import './style.css';
import { qrCodeSvg } from './qr-generation';
import { DEFAULT_OPTIONS } from './label-theme';
import { applyLayout, labelCard } from './label-card';
import { required } from './dom';

const SAMPLE_NAME = 'Léa';

const sample = required('sample-label', HTMLDivElement);
applyLayout(sample, DEFAULT_OPTIONS.size);
sample.append(labelCard(SAMPLE_NAME, qrCodeSvg(SAMPLE_NAME), DEFAULT_OPTIONS));
