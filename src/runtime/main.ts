// Browser entry point, inlined at the end of the generated page (standalone)
// or inside each form's root element (fragment output, decision 0019). The
// bundle self-initializes: when the running <script> sits inside a
// .yaml-form-root (fragment), it initializes just that root; otherwise
// (standalone, script after the form) it initializes every root on the page.
import { initForm } from "./form.ts";

const own = document.currentScript?.closest?.(".yaml-form-root");
if (own) {
	initForm(own);
} else {
	for (const root of Array.from(document.querySelectorAll(".yaml-form-root"))) {
		initForm(root);
	}
}
