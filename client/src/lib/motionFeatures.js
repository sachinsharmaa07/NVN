// Motion's animation features, loaded after first paint by LazyMotion in app/Providers.jsx so they stay
// out of the main chunk. domMax (not domAnimation) because the drawer drags and the tab indicator uses layoutId.
import { domMax } from "motion/react";

export default domMax;
