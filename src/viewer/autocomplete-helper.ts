import SuggestionList from "./SuggestionList.svelte";
import * as sh from "./selection-helper";

export default class AutocompleteHelper {
    #target: HTMLElement;
    #list: SuggestionList;

    constructor(target: HTMLElement, suggestions: readonly string[]) {
        this.#target = target;
        this.#list = new SuggestionList({  
            target,
            props: { suggestions }
        });
    }

    next() {
        this.#list.next();
    }

    prev() {
        this.#list.prev();
    }

    destroy() {
        this.#list.$destroy();
    }

    update(target: HTMLElement, suggestions: string[]) {
        const props = { suggestions };
        if (this.#target == target) {
            this.#list.$set(props);
        } else {
            this.#list.$destroy();
            this.#list = new SuggestionList({ target, props });
            this.#target = target;
        }
    }

    complete() {
        const selected = this.#list.getSelected();
        this.destroy();
        if (selected == null) {
            return false;
        } else {
            const el = this.#target;
            const span = el.querySelector("span.content") as HTMLSpanElement;
            const text = document.createTextNode(selected);
            span.removeAttribute("placeholder");
            span.innerHTML = "";
            span.appendChild(text);
            sh.setCaret(text, 0, true);
            return true;
        }
    }
}
