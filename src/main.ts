import { createApp } from 'vue';
import App from './App.vue';
import {
    Button,
    Cell,
    CellGroup,
    NavBar,
    Form,
    Field,
    Popup,
    Empty,
    Icon,
    Toast,
    Dialog,
    Tab,
    Tabs,
    Card,
    Tag,
    Notify
} from 'vant';
// 创建Vue应用
const app = createApp(App);

// 注册Vant组件
app.use(Button);
app.use(Cell);
app.use(CellGroup);
app.use(NavBar);
app.use(Form);
app.use(Field);
app.use(Popup);
app.use(Empty);
app.use(Icon);
app.use(Toast);
app.use(Dialog);
app.use(Tab);
app.use(Tabs);
app.use(Card);
app.use(Tag);
app.use(Notify);

// 挂载应用
app.mount('#app');