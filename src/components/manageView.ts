import { ref } from 'vue';
import { defineAsyncComponent } from 'vue';

export interface View {
  id: string;
  name: string;
  component: any;
}

const views: View[] = [
  {
    id: 'visualizer',
    name: 'MIDI Visualizer',
    component: defineAsyncComponent(() => import('./MagentaStaffVisualizer.vue'))
  },
  {
    id: 'tabs',
    name: 'Tab Management',
    component: defineAsyncComponent(() => import('./UkeTabManagement.vue'))
  }
];

const currentView = ref<View>(views[0]);

export function useViewManager() {
  const setView = (viewId: string) => {
    const view = views.find(v => v.id === viewId);
    if (view) {
      currentView.value = view;
    }
  };

  return {
    views,
    currentView,
    setView
  };
}
