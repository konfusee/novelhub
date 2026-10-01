import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlignJustify, AlignLeft, ArrowLeft, ArrowRight, Bookmark, BookOpen, Check, Copy, Flag, Focus, Highlighter, List, Menu, MessageSquareText, NotebookPen, Settings2, Share2, Trash2 } from 'lucide-react'
import { ReaderLayout } from '../../layouts'
import { Button, Card, Drawer, IconButton, Input } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'
import { fullChapter } from '../../data/mock/reader'

const SETTINGS_KEY = 'novelhub.reader.settings.v2'
const BOOKMARK_KEY = 'novelhub.reader.bookmarks.v1'
const ANNOTATIONS_KEY = 'novelhub.reader.annotations.v1'
const POSITION_KEY = 'novelhub.reader.position.v1'
const fontOptions = [14, 16, 18, 20, 22, 24, 26, 28]
const DEFAULT_READER_FONT = "'Be Vietnam Pro', ui-sans-serif, sans-serif"
const readerFonts = [
  ['Be Vietnam Pro', DEFAULT_READER_FONT],
  ['Arial', 'Arial, ui-sans-serif, sans-serif'],
  ['Giao diện hệ thống', 'ui-sans-serif, system-ui, sans-serif'],
]
const colors = { yellow: '#f4df8d', green: '#9fd8b9', blue: '#9ec9e8', pink: '#e9afc0' }
const readStored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }

function ToolButton({ active, label, children, onClick }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`grid size-8 shrink-0 place-items-center rounded-lg text-xs transition ${active ? 'bg-brand text-white' : 'text-muted hover:bg-elevated hover:text-ink'}`}>{children}</button>
}

function ReaderToolbar({ settings, update, bookmarked, toggleBookmark, openNotes, openChapters, openSettings, focus, toggleFocus, t }) {
  const fontIndex = fontOptions.indexOf(settings.fontSize)
  return <div className="sticky top-16 z-30 border-y border-line bg-page/95 py-2 backdrop-blur">
    <div className="mx-auto h-1 max-w-[1100px] overflow-hidden rounded-full bg-line"><div className="h-full bg-brand" style={{ width: `${settings.progress}%` }} /></div>
    <div className="mx-auto mt-2 flex min-h-12 max-w-[1100px] items-center gap-2 rounded-2xl border border-line bg-surface px-2 shadow-sm sm:px-3">
      <div className="hidden items-center gap-1 sm:flex"><ToolButton label={`${t('reader.fontSize')} −`} onClick={() => update('fontSize', fontOptions[Math.max(0, fontIndex - 1)])}>A−</ToolButton><span className="w-7 text-center text-[10px] font-semibold">{settings.fontSize}</span><ToolButton label={`${t('reader.fontSize')} +`} onClick={() => update('fontSize', fontOptions[Math.min(fontOptions.length - 1, fontIndex + 1)])}>A+</ToolButton></div>
      <span className="hidden h-6 w-px bg-line sm:block" />
      <label title={t('reader.contentWidth')} className="hidden items-center gap-2 text-[10px] text-muted md:flex"><span>↔</span><input aria-label={t('reader.contentWidth')} type="range" min="640" max="1100" step="20" value={settings.width} onChange={e => update('width', Number(e.target.value))} className="w-24 accent-[var(--primary)]" /><span className="w-8">{settings.width}</span></label>
      <span className="hidden h-6 w-px bg-line md:block" />
      <div className="hidden items-center gap-1 lg:flex"><ToolButton active={settings.align === 'left'} label={t('reader.left')} onClick={() => update('align','left')}><AlignLeft size={15}/></ToolButton><ToolButton active={settings.align === 'justify'} label={t('reader.justify')} onClick={() => update('align','justify')}><AlignJustify size={15}/></ToolButton>{[1.4,1.6,1.8,2].map(value => <button key={value} title={t('reader.lineHeight')} onClick={() => update('lineHeight',value)} className={`rounded-lg px-2 py-1.5 text-[10px] ${settings.lineHeight === value ? 'bg-brand text-white' : 'text-muted hover:bg-elevated'}`}>{value}</button>)}</div>
      <div className="ml-auto flex items-center gap-1"><ToolButton active={bookmarked} label={t('reader.bookmark')} onClick={toggleBookmark}><Bookmark size={16} className={bookmarked ? 'fill-current' : ''}/></ToolButton><ToolButton label={t('reader.notes')} onClick={openNotes}><NotebookPen size={16}/></ToolButton><ToolButton label={t('reader.chapters')} onClick={openChapters}><List size={17}/></ToolButton><ToolButton label={t('reader.settings')} onClick={openSettings}><Settings2 size={16}/></ToolButton><ToolButton active={focus} label={focus ? t('reader.exitFocus') : t('reader.focus')} onClick={toggleFocus}><Focus size={16}/></ToolButton></div>
    </div>
  </div>
}

function SettingsPanel({ settings, update, t }) {
  return <div className="space-y-5">
    <label className="block text-xs font-semibold">{t('reader.fontSize')} <span className="float-right text-brand">{settings.fontSize}px</span><input type="range" min="14" max="28" step="2" value={settings.fontSize} onChange={e => update('fontSize',Number(e.target.value))} className="mt-3 w-full accent-[var(--primary)]"/></label>
    <label className="block text-xs font-semibold">{t('reader.contentWidth')} <span className="float-right text-brand">{settings.width}px</span><input type="range" min="640" max="1100" step="20" value={settings.width} onChange={e => update('width',Number(e.target.value))} className="mt-3 w-full accent-[var(--primary)]"/></label>
    <div><p className="mb-2 text-xs font-semibold">{t('reader.lineHeight')}</p><div className="grid grid-cols-4 gap-2">{[1.4,1.6,1.8,2].map(value => <Button key={value} variant={settings.lineHeight === value ? 'primary' : 'secondary'} className="min-h-9 px-2 py-1 text-xs" onClick={() => update('lineHeight',value)}>{value}</Button>)}</div></div>
    <div><p className="mb-2 text-xs font-semibold">{t('reader.paragraphSpacing')}</p><div className="grid grid-cols-3 gap-2">{[['compact',12],['comfortable',22],['relaxed',32]].map(([key,value]) => <Button key={key} variant={settings.paragraphGap === value ? 'primary' : 'secondary'} className="min-h-9 px-2 py-1 text-[10px]" onClick={() => update('paragraphGap',value)}>{t(`reader.${key}`)}</Button>)}</div></div>
    <div><p className="mb-2 text-xs font-semibold">{t('reader.alignment')}</p><div className="grid grid-cols-2 gap-2"><Button variant={settings.align === 'left' ? 'primary' : 'secondary'} onClick={() => update('align','left')}><AlignLeft size={15}/>{t('reader.left')}</Button><Button variant={settings.align === 'justify' ? 'primary' : 'secondary'} onClick={() => update('align','justify')}><AlignJustify size={15}/>{t('reader.justify')}</Button></div></div>
    <div><p className="mb-2 text-xs font-semibold">Phông chữ</p><select value={settings.fontFamily} onChange={e => update('fontFamily',e.target.value)} className="min-h-11 w-full rounded-2xl border border-line bg-surface px-3 text-sm">{readerFonts.map(([label,value])=><option value={value} key={label}>{label}</option>)}</select></div>
  </div>
}

export function FullChapterReaderPage() {
  const { t } = useLocale()
  const articleRef = useRef(null)
  const [settings,setSettings] = useState(() => {
    const stored = readStored(SETTINGS_KEY,{})
    const allowedFonts = readerFonts.map(([,value]) => value)
    return { fontSize:18,width:820,lineHeight:1.8,paragraphGap:22,align:'left',progress:0,...stored,fontFamily:allowedFonts.includes(stored.fontFamily) ? stored.fontFamily : DEFAULT_READER_FONT }
  })
  const [bookmarked,setBookmarked] = useState(() => readStored(BOOKMARK_KEY,[]).includes('demo-14'))
  const [annotations,setAnnotations] = useState(() => readStored(ANNOTATIONS_KEY,[]))
  const [selection,setSelection] = useState(null)
  const [noteDraft,setNoteDraft] = useState('')
  const [editingId,setEditingId] = useState(null)
  const [noteOpen,setNoteOpen] = useState(false)
  const [notesOpen,setNotesOpen] = useState(false)
  const [chaptersOpen,setChaptersOpen] = useState(false)
  const [settingsOpen,setSettingsOpen] = useState(false)
  const [focus,setFocus] = useState(false)
  const [toast,setToast] = useState('')
  const [chapterQuery,setChapterQuery] = useState('')
  const update = (key,value) => setSettings(current => { const next={...current,[key]:value}; localStorage.setItem(SETTINGS_KEY,JSON.stringify(next)); return next })

  useEffect(() => {
    const updateProgress=()=>{ const height=document.documentElement.scrollHeight-innerHeight; const progress=height>0?Math.min(100,Math.round(scrollY/height*100)):0; setSettings(current=>({...current,progress})); localStorage.setItem(POSITION_KEY,JSON.stringify({chapter:'demo-14',y:scrollY})) }
    const saved=readStored(POSITION_KEY,null); if(saved?.chapter==='demo-14') requestAnimationFrame(()=>scrollTo({top:saved.y,behavior:'instant'})); addEventListener('scroll',updateProgress,{passive:true}); updateProgress(); return()=>removeEventListener('scroll',updateProgress)
  },[])
  useEffect(()=>{ document.documentElement.dataset.readerFocus=String(focus); return()=>{delete document.documentElement.dataset.readerFocus} },[focus])
  useEffect(()=>{ if(!toast)return; const timer=setTimeout(()=>setToast(''),2200); return()=>clearTimeout(timer) },[toast])

  const toggleBookmark=()=>{ const next=!bookmarked; setBookmarked(next); const stored=readStored(BOOKMARK_KEY,[]).filter(id=>id!=='demo-14'); localStorage.setItem(BOOKMARK_KEY,JSON.stringify(next?[...stored,'demo-14']:stored)); setToast(t(next?'reader.bookmarked':'reader.unbookmarked')) }
  const captureSelection=()=>{ const selected=window.getSelection(); const text=selected?.toString().trim(); if(!text||!articleRef.current?.contains(selected.anchorNode)){setSelection(null);return} const paragraph=selected.anchorNode?.parentElement?.closest('[data-paragraph]'); const rect=selected.getRangeAt(0).getBoundingClientRect(); setSelection({text,index:Number(paragraph?.dataset.paragraph||0),x:Math.min(innerWidth-280,Math.max(12,rect.left+rect.width/2-130)),y:Math.max(76,rect.top-52)}) }
  const addHighlight=(color='yellow',note='')=>{ if(!selection)return; const next=editingId ? annotations.map(item=>item.id===editingId?{...item,note}:item) : [...annotations,{id:Date.now(),...selection,color,note}]; setAnnotations(next); localStorage.setItem(ANNOTATIONS_KEY,JSON.stringify(next)); setSelection(null); setEditingId(null); setNoteOpen(false); setNoteDraft(''); window.getSelection()?.removeAllRanges(); setToast(t('reader.highlight')) }
  const copySelection=async()=>{if(selection)await navigator.clipboard?.writeText(selection.text);setToast(t('reader.copy'));setSelection(null)}
  const shareSelection=async()=>{if(selection&&navigator.share)await navigator.share({title:fullChapter.story,text:selection.text});else if(selection)await navigator.clipboard?.writeText(selection.text);setToast(t('reader.share'));setSelection(null)}
  const removeAnnotation=id=>{const next=annotations.filter(item=>item.id!==id);setAnnotations(next);localStorage.setItem(ANNOTATIONS_KEY,JSON.stringify(next))}
  const renderParagraph=(paragraph,index)=>{const mark=annotations.find(item=>item.index===index&&paragraph.includes(item.text));if(!mark)return paragraph;const parts=paragraph.split(mark.text);return <>{parts[0]}<mark id={`annotation-${mark.id}`} title={mark.note||t('reader.highlight')} className="rounded px-0.5 text-inherit" style={{backgroundColor:colors[mark.color],color:'#172033'}}>{mark.text}{mark.note&&<sup className="ml-1 text-[9px]">●</sup>}</mark>{parts.slice(1).join(mark.text)}</>}
  const chapters=useMemo(()=>Array.from({length:fullChapter.total},(_,i)=>i+1).filter(number=>`${number}`.includes(chapterQuery)),[chapterQuery])
  const closePanels=()=>{setSettingsOpen(false);setNotesOpen(false);setChaptersOpen(false)}

  return <ReaderLayout><div className="reader-page min-h-screen bg-reader pb-12 text-ink">
    <section className="mx-auto max-w-[1100px] px-4 pb-4 pt-7 sm:px-6"><Link to="/reader/library" className="inline-flex items-center gap-2 text-xs text-muted hover:text-brand"><ArrowLeft size={15}/>{t('reader.back')}</Link><div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] uppercase tracking-[.18em] text-brand">{fullChapter.story} · Chương {fullChapter.number} / {fullChapter.total}</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Chương {fullChapter.number}: {fullChapter.title}</h1><p className="mt-2 text-xs text-muted">{fullChapter.author} · {fullChapter.readTime}</p></div><p className="text-xs font-semibold text-brand">{settings.progress}%</p></div></section>
    <ReaderToolbar settings={settings} update={update} bookmarked={bookmarked} toggleBookmark={toggleBookmark} openNotes={()=>setNotesOpen(true)} openChapters={()=>setChaptersOpen(true)} openSettings={()=>setSettingsOpen(true)} focus={focus} toggleFocus={()=>setFocus(value=>!value)} t={t}/>
    <main className="reading-container mx-auto mt-8 transition-[max-width] duration-200" style={{maxWidth:`${settings.width}px`}}><figure className="mx-4 overflow-hidden rounded-3xl border border-line bg-surface sm:mx-6"><div className="grid aspect-[16/7] place-items-center bg-[#31584c] text-white"><BookOpen size={58} className="opacity-60"/></div><figcaption className="p-3 text-center text-[10px] text-muted">The sun filtering through the silvered elder canopy at dawn.</figcaption></figure><article ref={articleRef} onMouseUp={captureSelection} onKeyUp={captureSelection} className="mx-4 mt-8 rounded-3xl border border-line bg-surface px-6 py-8 shadow-sm sm:mx-6 sm:px-10 sm:py-12" style={{fontFamily:settings.fontFamily,fontSize:`${settings.fontSize}px`,lineHeight:settings.lineHeight,textAlign:settings.align}}>{fullChapter.paragraphs.map((paragraph,index)=><p data-paragraph={index} key={paragraph.slice(0,24)} style={{marginBottom:index===fullChapter.paragraphs.length-1?0:`${settings.paragraphGap}px`}} className={index===0?'first-letter:float-left first-letter:mr-2 first-letter:text-6xl first-letter:font-semibold first-letter:leading-[.8] first-letter:text-brand':''}>{renderParagraph(paragraph,index)}</p>)}</article><nav className="mx-4 mt-8 flex flex-col justify-between gap-3 border-t border-line pt-6 sm:mx-6 sm:flex-row"><Button variant="secondary" onClick={()=>setToast(t('reader.previous'))}><ArrowLeft size={16}/>{t('reader.previous')}</Button><Button onClick={()=>setToast(t('reader.next'))}>{t('reader.next')}<ArrowRight size={16}/></Button></nav></main>
    {selection&&<div role="toolbar" className="fixed z-[70] flex items-center gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-xl" style={{left:selection.x,top:selection.y}}><ToolButton label={t('reader.highlight')} onClick={()=>addHighlight('yellow')}><Highlighter size={15}/></ToolButton><div className="flex gap-1 px-1">{Object.entries(colors).map(([name,color])=><button key={name} aria-label={`${t('reader.highlight')} ${name}`} onClick={()=>addHighlight(name)} className="size-4 rounded-full border border-line" style={{backgroundColor:color}}/>)}</div><ToolButton label={t('reader.addNote')} onClick={()=>setNoteOpen(true)}><MessageSquareText size={15}/></ToolButton><ToolButton label={t('reader.copy')} onClick={copySelection}><Copy size={15}/></ToolButton><ToolButton label={t('reader.share')} onClick={shareSelection}><Share2 size={15}/></ToolButton><ToolButton label={t('reader.report')} onClick={()=>{setToast(t('reader.report'));setSelection(null)}}><Flag size={15}/></ToolButton></div>}
    {noteOpen&&selection&&<div className="fixed z-[80] w-[min(360px,calc(100vw-24px))] rounded-2xl border border-line bg-surface p-4 shadow-2xl" style={{left:Math.max(12,Math.min(selection.x,innerWidth-372)),top:Math.min(innerHeight-230,selection.y+48)}}><strong className="text-sm">{t('reader.addNote')}</strong><p className="mt-2 line-clamp-2 text-xs text-muted">“{selection.text}”</p><textarea autoFocus value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} placeholder={t('reader.notePlaceholder')} className="mt-3 min-h-24 w-full rounded-xl border border-line bg-elevated p-3 text-sm outline-none focus:border-brand"/><div className="mt-3 flex justify-end gap-2"><Button variant="ghost" onClick={()=>setNoteOpen(false)}>{t('reader.cancel')}</Button><Button onClick={()=>addHighlight('yellow',noteDraft)}>{t('reader.save')}</Button></div></div>}
    {toast&&<div role="status" className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs text-page shadow-xl"><Check size={14} className="mr-2 inline"/>{toast}</div>}
    <Drawer open={settingsOpen} title={t('reader.settings')} onClose={()=>setSettingsOpen(false)}><SettingsPanel settings={settings} update={update} t={t}/></Drawer>
    <Drawer open={notesOpen} title={t('reader.notes')} onClose={()=>setNotesOpen(false)}>{annotations.length?<div className="space-y-3">{annotations.map(item=><Card key={item.id} className="p-4"><p className="line-clamp-3 text-xs text-muted">“{item.text}”</p>{item.note&&<p className="mt-3 text-sm">{item.note}</p>}<div className="mt-3 flex gap-2"><Button variant="secondary" className="min-h-8 px-3 py-1 text-[10px]" onClick={()=>{document.getElementById(`annotation-${item.id}`)?.scrollIntoView({behavior:'smooth',block:'center'});setNotesOpen(false)}}>{t('reader.jump')}</Button><Button variant="secondary" className="min-h-8 px-3 py-1 text-[10px]" onClick={()=>{setSelection(item);setEditingId(item.id);setNoteDraft(item.note||'');setNotesOpen(false);setNoteOpen(true)}}>{t('reader.edit')}</Button><IconButton label={t('reader.delete')} className="size-8" onClick={()=>removeAnnotation(item.id)}><Trash2 size={14}/></IconButton></div></Card>)}</div>:<p className="text-sm text-muted">{t('reader.noNotes')}</p>}</Drawer>
    <Drawer open={chaptersOpen} title={t('reader.chapters')} onClose={()=>setChaptersOpen(false)}><Input icon={Menu} placeholder={t('reader.searchChapters')} value={chapterQuery} onChange={e=>setChapterQuery(e.target.value)}/><div className="mt-4 space-y-1">{chapters.map(number=><button key={number} onClick={()=>{setChaptersOpen(false);setToast(`Chương ${number}`)}} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs ${number===fullChapter.number?'bg-brand text-white':'hover:bg-surface'}`}><span>Chương {String(number).padStart(2,'0')}</span>{number===fullChapter.number&&<Bookmark size={13} className="fill-current"/>}</button>)}</div></Drawer>
    {(settingsOpen||notesOpen||chaptersOpen)&&<button aria-label="Đóng bảng điều khiển" className="fixed inset-0 z-40 bg-black/30" onClick={closePanels}/>}
  </div></ReaderLayout>
}
