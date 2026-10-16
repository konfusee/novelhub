import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, ShieldCheck, Upload } from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  ProgressBar,
  Select,
  Skeleton,
} from '../../components/ui';
import { apiRequest } from '../../api/client';
import { useBackendResource } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import { suggestDocumentChapters } from './documentChapters';
import { chapterParagraphs, ChapterTextError } from './chapterParagraphs';

const formats = ['pdf', 'doc', 'docx', 'txt', 'md'];
const wordCount = (text) => text.trim().split(/\s+/u).filter(Boolean).length;
export function ImportPdfPage() {
  const { t, formatNumber } = useLocale();
  const message = (key, values) => t(`documentImport.${key}`, values);
  const picker = useRef(null);
  const pending = useRef(null);
  const busyRef = useRef(false);
  const cursor = useRef(0);
  const targets = useBackendResource('/author/imports/targets');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [active, setActive] = useState('');
  const [destination, setDestination] = useState('');
  const [result, setResult] = useState(null);
  useEffect(() => () => pending.current?.abort(), []);
  const selected = chapters.filter((chapter) => chapter.selected);
  const current = chapters.find((chapter) => chapter.id === active);
  const target = targets.data.find((story) => story.id === destination);
  const step = result ? 4 : preview ? 3 : busy ? 2 : 1;
  const update = (id, patch) =>
    setChapters((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  async function choose(file) {
    if (!file || busyRef.current) return;
    const format = file.name.split('.').pop().toLowerCase();
    if (!formats.includes(format) || !file.size || file.size > 10 * 1024 * 1024) {
      setError(message('invalidFile'));
      return;
    }
    busyRef.current = true;
    const controller = new AbortController();
    pending.current = controller;
    setBusy('extract');
    setError('');
    setPreview(null);
    setChapters([]);
    setResult(null);
    try {
      const response = await apiRequest(`/author/imports/preview?format=${format}`, {
        method: 'POST',
        body: file,
        binary: true,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const first = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^.]+$/, '').slice(0, 200),
        text: response.text,
        selected: true,
      };
      setPreview({ ...response, name: file.name });
      setChapters([first]);
      setActive(first.id);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        busyRef.current = false;
        setBusy('');
      }
    }
  }
  function split() {
    const at = cursor.current;
    if (
      !current ||
      at <= 0 ||
      at >= current.text.length ||
      !current.text.slice(0, at).trim() ||
      !current.text.slice(at).trim()
    ) {
      setError(message('splitHint'));
      return;
    }
    const index = chapters.findIndex((chapter) => chapter.id === active);
    const next = {
      id: crypto.randomUUID(),
      title: message('untitled'),
      text: current.text.slice(at),
      selected: true,
    };
    setChapters([
      ...chapters.slice(0, index),
      { ...current, text: current.text.slice(0, at) },
      next,
      ...chapters.slice(index + 1),
    ]);
    setActive(next.id);
    cursor.current = 0;
    setError('');
  }
  function suggest() {
    if (!current || busyRef.current) return;
    const suggestions = suggestDocumentChapters(current.text, message('preamble'));
    if (!suggestions || chapters.length - 1 + suggestions.length > 100) {
      setError(message('noHeadings'));
      return;
    }
    const index = chapters.findIndex((chapter) => chapter.id === active);
    const replacements = suggestions.map((chapter) => ({
      ...chapter,
      id: crypto.randomUUID(),
      selected: current.selected,
    }));
    setChapters([...chapters.slice(0, index), ...replacements, ...chapters.slice(index + 1)]);
    setActive(replacements[0].id);
    cursor.current = 0;
    setError('');
  }
  function merge(index) {
    const following = chapters[index + 1];
    if (!following) return;
    const merged = { ...chapters[index], text: `${chapters[index].text}\n\n${following.text}` };
    setChapters([...chapters.slice(0, index), merged, ...chapters.slice(index + 2)]);
    setActive(merged.id);
  }
  async function save() {
    if (busyRef.current || !target || !selected.length) return;
    busyRef.current = true;
    setBusy('save');
    setError('');
    const controller = new AbortController();
    pending.current = controller;
    try {
      const response = await apiRequest('/author/imports', {
        method: 'POST',
        signal: controller.signal,
        body: {
          receipt: preview.receipt,
          storyId: target.id,
          expectedVersion: target.version,
          chapters: selected.map((chapter) => ({
            title: chapter.title,
            paragraphs: chapterParagraphs(chapter.text),
          })),
        },
      });
      if (!controller.signal.aborted) setResult(response);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof ChapterTextError ? t(`chapterText.${failure.code}`) : failure.message,
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        busyRef.current = false;
        setBusy('');
      }
    }
  }
  return (
    <AuthorLayout>
      <div className="page-author py-6 lg:py-8">
        <Card className="p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 items-start gap-3">
              <ButtonLink
                to="/author/drafts"
                variant="secondary"
                size="sm"
                aria-label={message('back')}
              >
                <ArrowLeft size={16} />
              </ButtonLink>
              <div className="min-w-0">
                <h1 className="text-h2 sm:text-h1">{message('title')}</h1>
                <p className="mt-1 max-w-[65ch] text-sm text-muted">{message('description')}</p>
              </div>
            </div>
            <Badge className="self-start whitespace-normal">
              <ShieldCheck size={14} />
              {message('temporary')}
            </Badge>
          </div>
          <ol className="nh-grid-12 mt-6 grid gap-4 border-t border-hairline pt-5 nh-sm-cols-2 nh-xl-cols-4">
            {['upload', 'extract', 'review', 'draft'].map((key, index) => (
              <li
                key={key}
                aria-current={step === index + 1 ? 'step' : undefined}
                className="flex items-center gap-3"
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full border text-sm font-semibold ${step >= index + 1 ? 'border-brand bg-brand/12 text-brand-strong' : 'border-line text-muted'}`}
                >
                  {index + 1}
                </span>
                <strong className="text-sm">{message(key)}</strong>
              </li>
            ))}
          </ol>
          <ProgressBar
            value={result ? 4 : step - 1}
            max={4}
            size="sm"
            label={message('progress')}
            className="mt-5"
          />
        </Card>
        <input
          ref={picker}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          accept=".pdf,.doc,.docx,.txt,.md"
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        {error && (
          <Card className="mt-6 border-rose/40 text-rose-strong" role="alert">
            {error}
          </Card>
        )}
        {result ? (
          <Card className="mt-6">
            <EmptyState
              icon={CheckCircle2}
              title={message('success', { count: result.chapterIds.length })}
              description={message('saved')}
              action={
                <>
                  <ButtonLink to="/author/drafts">{message('openDrafts')}</ButtonLink>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setResult(null);
                      setPreview(null);
                      setChapters([]);
                      targets.retry();
                    }}
                  >
                    {message('another')}
                  </Button>
                </>
              }
            />
          </Card>
        ) : (
          <>
            {!preview && (
              <Card
                className="mt-6 p-6 sm:p-10"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  choose(event.dataTransfer.files?.[0]);
                }}
              >
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line p-6 text-center">
                  <Upload size={32} className="text-brand" />
                  <h2 className="text-h3">{message(busy ? 'extracting' : 'pickTitle')}</h2>
                  <p className="text-sm text-muted">{message('formats')}</p>
                  <Button disabled={!!busy} onClick={() => picker.current?.click()}>
                    {message('pick')}
                  </Button>
                  {busy === 'extract' && (
                    <Button variant="secondary" onClick={() => pending.current?.abort()}>
                      {message('cancel')}
                    </Button>
                  )}
                </div>
              </Card>
            )}
            {preview && (
              <>
                <div className="nh-grid-12 mt-6 grid items-start gap-6 nh-layout-xl-7-5">
                  <Card className="min-w-0 p-4 sm:p-6">
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-elevated p-4">
                      <FileText size={24} className="shrink-0 text-brand" />
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{preview.name}</strong>
                        <p className="text-xs text-muted">
                          {message('words', {
                            count: formatNumber(
                              wordCount(chapters.map((chapter) => chapter.text).join(' ')),
                            ),
                          })}
                          {preview.pageCount
                            ? ` · ${message('pages', { count: preview.pageCount })}`
                            : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!!busy}
                        onClick={() => picker.current?.click()}
                      >
                        {message('another')}
                      </Button>
                    </div>
                    <h2 className="mt-6 text-h3">{message('chapters')}</h2>
                    <p className="mt-1 text-sm text-muted">{message('reviewHint')}</p>
                    <ul className="mt-5 max-h-[690px] space-y-3 overflow-y-auto pr-1">
                      {chapters.map((chapter, index) => (
                        <li
                          key={chapter.id}
                          className={`rounded-2xl border p-4 ${active === chapter.id ? 'border-brand bg-brand/5' : 'border-line'}`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={chapter.selected}
                              disabled={!!busy}
                              aria-label={message('selectChapter', { number: index + 1 })}
                              onChange={(event) =>
                                update(chapter.id, { selected: event.target.checked })
                              }
                            />
                            <Input
                              aria-label={message('chapterTitle', { number: index + 1 })}
                              value={chapter.title}
                              maxLength={200}
                              disabled={!!busy}
                              onChange={(event) =>
                                update(chapter.id, { title: event.target.value })
                              }
                              className="min-w-0 flex-1"
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!!busy}
                              onClick={() => {
                                setActive(chapter.id);
                                cursor.current = 0;
                              }}
                            >
                              {message('edit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!!busy || index === chapters.length - 1}
                              onClick={() => merge(index)}
                            >
                              {message('merge')}
                            </Button>
                            <span className="self-center text-xs text-muted">
                              {message('words', { count: formatNumber(wordCount(chapter.text)) })}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card className="min-w-0 p-4 sm:p-6">
                    <h2 className="text-h3">{message('text')}</h2>
                    <p className="mt-2 text-sm text-muted">{message('plainText')}</p>
                    {current && (
                      <>
                        <label className="mt-5 block text-sm font-semibold" htmlFor="import-text">
                          {current.title || message('untitled')}
                        </label>
                        <textarea
                          id="import-text"
                          className="mt-2 min-h-96 w-full resize-y rounded-2xl border border-line bg-surface p-4 text-sm leading-7 text-ink"
                          value={current.text}
                          disabled={!!busy}
                          onSelect={(event) => {
                            cursor.current = event.target.selectionStart;
                          }}
                          onChange={(event) => update(current.id, { text: event.target.value })}
                        />
                        <Button
                          className="mt-3"
                          variant="secondary"
                          disabled={!!busy || chapters.length >= 100}
                          onClick={split}
                        >
                          {message('split')}
                        </Button>
                        <Button
                          className="mt-3 sm:ml-2"
                          variant="secondary"
                          disabled={!!busy}
                          onClick={suggest}
                        >
                          {message('suggest')}
                        </Button>
                        <p className="mt-2 text-xs text-muted">{message('splitHint')}</p>
                      </>
                    )}
                  </Card>
                </div>
                <Card className="mt-6 p-4 sm:p-6">
                  <h2 className="text-h3">{message('destination')}</h2>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {targets.status === 'loading' ? (
                      <Skeleton className="h-11 w-full" />
                    ) : targets.status === 'error' ? (
                      <p role="alert">{message('targetError')}</p>
                    ) : targets.status === 'empty' ? (
                      <p className="text-sm text-muted">{message('noTargets')}</p>
                    ) : (
                      <Select
                        aria-label={message('destination')}
                        value={destination}
                        onChange={(event) => setDestination(event.target.value)}
                        disabled={!!busy}
                      >
                        <option value="">{message('chooseStory')}</option>
                        {targets.data.map((story) => (
                          <option key={story.id} value={story.id}>
                            {story.title}
                          </option>
                        ))}
                      </Select>
                    )}
                    <Button variant="secondary" disabled={!!busy} onClick={targets.retry}>
                      {message('refresh')}
                    </Button>
                    <ButtonLink
                      to="/author/stories/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="ghost"
                    >
                      {message('newStory')}
                    </ButtonLink>
                  </div>
                  <p className="mt-3 text-xs text-muted">{message('destinationHint')}</p>
                </Card>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-muted">
                    {message('selected', { count: selected.length })}
                  </p>
                  <Button
                    disabled={
                      !!busy ||
                      !target ||
                      !selected.length ||
                      selected.some((chapter) => !chapter.title.trim() || !chapter.text.trim())
                    }
                    onClick={save}
                  >
                    {message(busy === 'save' ? 'saving' : 'save')}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AuthorLayout>
  );
}
