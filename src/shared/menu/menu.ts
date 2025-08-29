import MenuComponent from './Menu.svelte';
import MenuAction from './MenuAction.svelte';
import MenuList from './MenuList.svelte';

export class Menu extends MenuComponent {
	static readonly Action = MenuAction;
	static readonly List = MenuList;
}

export default Menu;