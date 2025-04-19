import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import UkeTabManagement from '../components/UkeTabManagement.vue';
import UkeTabPlayChallenge from '../components/UkeTabPlayChallenge.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'tab-management',
    component: UkeTabManagement
  },
  {
    path: '/play/:id',
    name: 'tab-play',
    component: UkeTabPlayChallenge,
    props: true
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router; 