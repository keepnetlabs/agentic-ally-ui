<script setup lang="ts">
// @ts-nocheck - Nuxt auto-imports are available at runtime
import { ref, onMounted, onBeforeUnmount } from 'vue'
import grapesjs from 'grapesjs'
import 'grapesjs/dist/css/grapes.min.css'
import gjsPresetNewsletter from 'grapesjs-preset-newsletter'

// Load FontAwesome for GrapesJS icons
useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
    }
  ]
})

interface Props {
  html: string
  type: 'email' | 'landing-page'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  save: [html: string]
}>()

const editorContainer = ref<HTMLElement | null>(null)
let editor: any = null

const handleSave = () => {
  if (editor) {
    // Get HTML and CSS from GrapesJS components
    const html = editor.getHtml()
    const css = editor.getCss()

    // Combine HTML and CSS
    const fullHtml = `
<style>${css}</style>
${html}
    `.trim()

    emit('save', fullHtml)
    emit('close')
  }
}

const handleCancel = () => {
  emit('close')
}

onMounted(() => {
  if (!editorContainer.value) return

  // Initialize GrapesJS
  editor = grapesjs.init({
    container: editorContainer.value,
    height: '100%',
    width: '100%',
    fromElement: false,
    storageManager: false, // Disable storage

    // Use newsletter preset for both email and landing pages
    plugins: [gjsPresetNewsletter],
    pluginsOpts: {
      'grapesjs-preset-newsletter': {
        modalLabelImport: 'Paste HTML',
        modalLabelExport: 'Copy HTML',
        codeViewerTheme: 'material',
        importPlaceholder: '<div>Paste your HTML here</div>',
        cellStyle: {
          'font-size': '12px',
          'font-weight': 300,
          'vertical-align': 'top',
          color: 'rgb(111, 119, 125)',
          margin: 0,
          padding: 0,
        }
      }
    } as any,

    canvas: {
      styles: [],
      scripts: [],
    },

    deviceManager: {
      devices: [{
        name: 'Desktop',
        width: '',
      }, {
        name: 'Tablet',
        width: '768px',
      }, {
        name: 'Mobile',
        width: '480px',
      }]
    },

    panels: {
      defaults: [{
        id: 'basic-actions',
        el: '.panel__basic-actions',
        buttons: [{
          id: 'visibility',
          active: true,
          className: 'btn-toggle-borders',
          label: '<i class="fa fa-clone"></i>',
          command: 'sw-visibility',
        }],
      }, {
        id: 'devices',
        el: '.panel__devices',
        buttons: [{
          id: 'device-desktop',
          label: '<i class="fa fa-desktop"></i>',
          command: 'set-device-desktop',
          active: true,
          togglable: false,
        }, {
          id: 'device-tablet',
          label: '<i class="fa fa-tablet"></i>',
          command: 'set-device-tablet',
          togglable: false,
        }, {
          id: 'device-mobile',
          label: '<i class="fa fa-mobile"></i>',
          command: 'set-device-mobile',
          togglable: false,
        }],
      }]
    },
  })

  // Register custom 'table-cell' component type for editable TD elements
  editor.DomComponents.addType('table-cell', {
    model: {
      defaults: {
        tagName: 'td',
        editable: true,
        draggable: false,  // Prevent table structure breaking
        droppable: false,
        resizable: false,
        selectable: true,
      } as any
    },
    view: {} as any
  } as any)

  // Configure HTML parser to recognize TD elements as table-cell type
  const originalParseHtml = editor.Parser.parseHtml

  editor.Parser.parseHtml = function(html: string, csso?: any) {
    const res = originalParseHtml.call(this, html, csso)

    const parseCells = (obj: any) => {
      if (obj.tagName === 'td') {
        obj.type = 'table-cell'
      }
      if (obj.components) {
        ;(obj.components as any[]).forEach(parseCells)
      }
    }

    if (Array.isArray(res)) {
      res.forEach(parseCells)
    } else {
      parseCells(res)
    }

    return res
  }

  // Load and render initial HTML
  if (props.html) {
    editor.setComponents(props.html)
  }

  // Add commands for device switching
  editor.Commands.add('set-device-desktop', {
    run: (editor: any) => editor.setDevice('Desktop')
  })
  editor.Commands.add('set-device-tablet', {
    run: (editor: any) => editor.setDevice('Tablet')
  })
  editor.Commands.add('set-device-mobile', {
    run: (editor: any) => editor.setDevice('Mobile')
  })
})

onBeforeUnmount(() => {
  // Cleanup editor
  if (editor) {
    editor.destroy()
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[9999] bg-white dark:bg-gray-950 flex flex-col">
    <!-- Header -->
    <div class="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-900">
      <div class="flex items-center gap-3">
        <UIcon name="i-lucide-code" class="w-5 h-5" />
        <h2 class="text-lg font-semibold">
          Edit {{ type === 'email' ? 'Email' : 'Landing Page' }}
        </h2>
      </div>

      <UTooltip text="Close">
        <UButton
          variant="ghost"
          icon="i-lucide-x"
          @click="handleCancel"
        />
      </UTooltip>
    </div>

    <!-- GrapesJS Editor -->
    <div class="flex-1 relative overflow-hidden">
      <!-- Toolbar panels -->
      <div class="absolute top-2 left-2 z-10 flex gap-2">
        <div class="panel__devices bg-white dark:bg-gray-800 rounded-lg shadow-md"></div>
        <div class="panel__basic-actions bg-white dark:bg-gray-800 rounded-lg shadow-md"></div>
      </div>

      <!-- Editor container -->
      <div ref="editorContainer" class="h-full w-full mb-8"></div>
    </div>

    <!-- Sticky Footer -->
    <div class="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-end gap-2 bg-white dark:bg-gray-900">
      <UButton
        variant="ghost"
        @click="handleCancel"
      >
        Cancel
      </UButton>
      <UButton
        color="primary"
        @click="handleSave"
      >
        Save Changes
      </UButton>
    </div>
    </div>
  </Teleport>
</template>

<style>
/* IMPORTANT: Not scoped to override GrapesJS defaults */

/* Canvas background */
.gjs-cv-canvas {
  background-color: #f5f5f5 !important;
}

/* Views container padding */
.gjs-pn-views-container {
  padding-top: 60px !important;
}

/* Frame margin */
.gjs-frame {
  margin-top: 32px !important;
}

/* Panel buttons - Optimized size */
.gjs-pn-btn {
  padding: 8px 10px !important;
  background-color: #4b5563 !important;
  color: white !important;
  border: 1px solid #6b7280 !important;
  border-radius: 4px !important;
  margin: 2px !important;
  min-width: 40px !important;
  min-height: 40px !important;
}

.gjs-pn-btn i {
  display: inline-block !important;
  font-size: 20px !important;
  line-height: 20px !important;
  color: white !important;
  opacity: 1 !important;
  visibility: visible !important;
  font-style: normal !important;
  width: auto !important;
  height: auto !important;
}

.gjs-pn-btn svg {
  display: inline-block !important;
  width: 20px !important;
  height: 20px !important;
  fill: white !important;
  stroke: white !important;
  opacity: 1 !important;
  visibility: visible !important;
}

.gjs-pn-btn:hover {
  background-color: #6b7280 !important;
}

.gjs-pn-btn.gjs-pn-active {
  background-color: #3b82f6 !important;
}

/* Force FontAwesome icons to show */
.gjs-pn-btn .fa,
.gjs-pn-btn .fas,
.gjs-pn-btn .far,
.gjs-pn-btn .fab {
  font-size: 20px !important;
  color: white !important;
  opacity: 1 !important;
  display: inline-block !important;
}

/* Left sidebar blocks - Force visibility */
.gjs-blocks-c,
.gjs-blocks-c * {
  opacity: 1 !important;
  visibility: visible !important;
}

.gjs-block {
  background-color: #4b5563 !important;
  color: white !important;
  opacity: 1 !important;
  visibility: visible !important;
  padding: 6px !important;
  margin: 3px !important;
  border-radius: 4px !important;
  border: 1px solid #6b7280 !important;
}

/* Special GrapesJS block classes - smaller with dark background */
.gjs-block.gjs-one-bg,
.gjs-block.gjs-four-color-h,
.gjs-block.gjs-one-bg.gjs-four-color-h {
  background-color: #4b5563 !important;
  color: white !important;
  padding: 6px !important;
}

.gjs-block svg,
.gjs-block i {
  fill: white !important;
  color: white !important;
  font-size: 18px !important;
  display: inline-block !important;
  opacity: 1 !important;
}

.gjs-block__media {
  opacity: 1 !important;
  display: block !important;
  margin-bottom: 0 !important;
}

.gjs-block-label {
  color: inherit !important;
  opacity: 1 !important;
  font-size: 11px !important;
  margin-top: 6px !important;
}

/* Toolbar icons on canvas elements */
.gjs-toolbar,
.gjs-toolbar * {
  opacity: 1 !important;
  visibility: visible !important;
}

.gjs-toolbar-item {
  background-color: #374151 !important;
  padding: 6px 8px !important;
  margin: 1px !important;
}

.gjs-toolbar-item,
.gjs-toolbar-item * {
  color: white !important;
  opacity: 1 !important;
  visibility: visible !important;
  padding-right: 4px !important;
}

.gjs-toolbar-item svg,
.gjs-toolbar-item i {
  fill: white !important;
  color: white !important;
  opacity: 1 !important;
  font-size: 16px !important;
  width: 16px !important;
  height: 16px !important;
}

/* Right sidebar (Style Manager) */
.gjs-sm-sector-title,
.gjs-sm-property,
.gjs-field,
.gjs-sm-property__label,
.gjs-sm-sector-label,
.gjs-sm-sector-label * {
  color: white !important;
  opacity: 1 !important;
  visibility: visible !important;
}

/* Top toolbar */
.gjs-toolbar-items,
.gjs-toolbar-items * {
  opacity: 1 !important;
  visibility: visible !important;
}

/* Layer manager */
.gjs-layers,
.gjs-layer,
.gjs-layer * {
  opacity: 1 !important;
  visibility: visible !important;
  color: white !important;
}

/* Dark mode overrides */
.dark .gjs-cv-canvas {
  background-color: #1f2937 !important;
}

.dark .gjs-pn-btn,
.dark .gjs-pn-btn *,
.dark .gjs-block,
.dark .gjs-block *,
.dark .gjs-toolbar-item,
.dark .gjs-toolbar-item *,
.dark .gjs-sm-sector-title,
.dark .gjs-sm-property,
.dark .gjs-field,
.dark .gjs-sm-sector-label,
.dark .gjs-sm-sector-label *,
.dark .gjs-layer,
.dark .gjs-layer * {
  color: white !important;
}

.dark .gjs-pn-btn:hover {
  background-color: #374151 !important;
}

/* Force show all GrapesJS color classes */
.gjs-four-color,
.gjs-one-bg,
.gjs-two-color,
.gjs-three-bg,
.gjs-color-warn {
  opacity: 1 !important;
  visibility: visible !important;
}
</style>
