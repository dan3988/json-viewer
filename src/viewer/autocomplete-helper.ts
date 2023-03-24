import SuggestionList from "./SuggestionList.svelte";
import * as dom from "./dom-helper";

export default class AutocompleteHelper {
    #target: HTMLElement;
    #list: SuggestionList;

    get target() {
        return this.#target;
    }

    constructor(target: HTMLElement, source: Iterable<number | string>, filter: string) {
        this.#target = target;
        this.#list = new SuggestionList({  
            target,
            props: { source, filter }
        });

        this.#list.$on("click", this.#onClick.bind(this));
    }

    #complete(selected: null | string) {
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

            dom.setCaret(text, 0, true);
            return true;
        }
    }

    #onClick(arg: CustomEvent) {
        this.#complete(arg.detail.suggestion);
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

    update(target: HTMLElement, source: Iterable<number | string>, filter: string) {
        const props = { source, filter };
        if (this.#target == target) {
            this.#list.$set(props);
        } else {
            this.#list.$destroy();
            this.#list = new SuggestionList({ target, props });
            this.#target = target;
        }
    }

    complete(): boolean {
        const selected = this.#list.getSelected();
        return this.#complete(selected);
    }
}
