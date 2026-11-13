import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Copyright,
  Eye,
  ImagePlus,
  Lightbulb,
  RefreshCw,
  Save,
  Tags,
  Trash2,
} from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { useBackendResource } from '../../api/useBackendResource'
import { apiRequest } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
import { StoryCover } from '../../components/story/StoryCover'
import { StoryTagEditor } from '../../components/author/StoryTagEditor'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Modal,
  SectionHeader,
  Skeleton,
} from '../../components/ui'

/* Chip widths of the genre labels above, so the skeleton row wraps like the real one. */
const genreChipWidths = ['w-20', 'w-24', 'w-[4.5rem]', 'w-44', 'w-24', 'w-28']
const steps = [
  ['create-basics', 'Thông tin cơ bản'],
  ['create-cover', 'Bìa và hình ảnh'],
  ['create-genre', 'Phân loại'],
  ['create-rights', 'Xuất bản và bản quyền'],
]
const MAX_COVER_BYTES = 10 * 1024 * 1024

export function CreateStoryPage() {
  const { t } = useLocale()
  const { currentUser } = useAuth()
  const genreOptions = useBackendResource('/catalog/categories')
  const busyRef = useRef(false)
  const [createdId, setCreatedId] = useState(null)
  const [requestError, setRequestError] = useState('')
  const sectionRefs = useRef([])
  const fileRef = useRef(null)
  const bannerFileRef = useRef(null)
  const [step, setStep] = useState(1)
  // Only the current step and steps that have been completed can be opened. This keeps the
  // wizard linear while still allowing an author to go back and edit an earlier step.
  const [completedStep, setCompletedStep] = useState(0)
  const [title, setTitle] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [genre, setGenre] = useState('')
  const [tags, setTags] = useState([])
  const [cover, setCover] = useState(null)
  const [coverError, setCoverError] = useState('')
  const [banner, setBanner] = useState(null)
  const [bannerError, setBannerError] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [draftState, setDraftState] = useState('idle')
  const [submitState, setSubmitState] = useState('idle')
  const [previewOpen, setPreviewOpen] = useState(false)

  const errors = {
    title: title.trim() ? '' : 'Hãy nhập tên truyện.',
    synopsis: synopsis.trim() ? '' : 'Hãy nhập tóm tắt truyện.',
    genre: genreOptions.data.some(item => item.id === genre) ? '' : 'Hãy chọn thể loại chính.',
  }
  const currentStepErrors =
    step === 1 ? [errors.title, errors.synopsis] : step === 3 ? [errors.genre] : []
  const genreLabel =
    genreOptions.data.find(item => item.id === genre)?.name ?? t('createData.chooseGenre')
  const previewStory = {
    title: title.trim() || 'Truyện chưa đặt tên',
    author: currentUser.name,
    cover: cover?.url,
    bannerUrl: banner?.url,
  }

  useEffect(() => {
    const section = sectionRefs.current[step - 1]
    if (typeof section?.scrollIntoView === 'function') {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [step])
  useEffect(() => () => cover && URL.revokeObjectURL(cover.url), [cover])
  useEffect(() => () => banner && URL.revokeObjectURL(banner.url), [banner])

  const goTo = number => {
    if (number < 1 || number > steps.length || number > completedStep + 1) return
    setStep(number)
  }
  const touch = invalidateFromStep => {
    setDraftState('idle')
    setSubmitState('idle')
    setRequestError('')
    if (invalidateFromStep) {
      setCompletedStep(previous => Math.min(previous, invalidateFromStep - 1))
    }
  }
  const completeStep = () => {
    setRequestError('')
    if (step === 1) {
      setShowErrors(true)
      if (errors.title || errors.synopsis) {
        setRequestError('Hãy hoàn thiện tên truyện và tóm tắt trước khi sang bước tiếp theo.')
        return
      }
    }
    if (step === 3) {
      setShowErrors(true)
      if (errors.genre) {
        setRequestError(errors.genre)
        return
      }
    }
    setShowErrors(false)
    setCompletedStep(previous => Math.max(previous, step))
    if (step < steps.length) setStep(step + 1)
  }
  const chooseCover = event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      return setCoverError(t('createData.coverInvalid'))
    if (file.size > MAX_COVER_BYTES) return setCoverError(t('createData.coverTooLarge'))
    setCoverError('')
    setCover({ name: file.name, url: URL.createObjectURL(file), file })
    touch(2)
  }
  const chooseBanner = event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      return setBannerError(t('createData.bannerInvalid'))
    if (file.size > MAX_COVER_BYTES) return setBannerError(t('createData.bannerTooLarge'))
    setBannerError('')
    setBanner({ name: file.name, url: URL.createObjectURL(file), file })
    touch(2)
  }
  const persist = async asDraft => {
    if (busyRef.current || createdId) return
    setShowErrors(!asDraft)
    const invalid =
      !title.trim() ||
      !genreOptions.data.some(item => item.id === genre) ||
      (!asDraft && errors.synopsis)
    if (invalid) {
      setRequestError(t('createData.required'))
      return
    }
    busyRef.current = true
    setRequestError('')
    setDraftState(asDraft ? 'saving' : 'idle')
    setSubmitState(asDraft ? 'idle' : 'submitting')
    try {
      const result = await apiRequest('/author/stories', {
        method: 'POST',
        body: { title: title.trim(), description: synopsis.trim(), categoryId: genre, tags },
      })
      if (!result.story?.id) throw new Error(t('createData.saveError'))
      setCreatedId(result.story.id)
      let coverMediaId = null
      let coverBannerMediaId = null
      for (const [asset, kind, key] of [
        [cover, 'cover', 'coverMediaId'],
        [banner, 'banner', 'coverBannerMediaId'],
      ]) {
        if (!asset?.file) continue
        const query = new URLSearchParams({ name: asset.name, kind, storyId: result.story.id })
        const uploaded = await apiRequest(`/author/media?${query.toString()}`, {
          method: 'POST',
          body: asset.file,
          binary: true,
        })
        if (!uploaded.asset?.id) throw new Error(t('createData.coverUploadError'))
        if (key === 'coverMediaId') coverMediaId = uploaded.asset.id
        else coverBannerMediaId = uploaded.asset.id
      }
      if (coverMediaId || coverBannerMediaId) {
        const updated = await apiRequest(`/author/stories/${result.story.id}`, {
          method: 'PUT',
          body: {
            title: title.trim(),
            description: synopsis.trim(),
            categoryId: genre,
            tags,
            ...(coverMediaId ? { coverMediaId } : {}),
            ...(coverBannerMediaId ? { coverBannerMediaId } : {}),
            expectedVersion: result.story.version,
          },
        })
        if (!updated.story?.id) throw new Error(t('createData.coverUploadError'))
      }
      setDraftState('saved')
      setSubmitState('done')
    } catch (error) {
      setRequestError(error.message || t('createData.saveError'))
      setDraftState('idle')
      setSubmitState('idle')
    } finally {
      busyRef.current = false
    }
  }
  const saveDraft = () => void persist(true)
  const submit = event => {
    event.preventDefault()
    if (step !== steps.length || completedStep < steps.length - 1) return
    void persist(false)
  }
  const saving = draftState === 'saving' || submitState === 'submitting'

  return (
    <AuthorLayout>
      <div className="page-author py-6 lg:py-8">
        <header className="border-b border-hairline pb-6">
          <p className="nh-eyebrow">{t('createData.step', { step })}</p>
          <h1 className="mt-3 text-h2 sm:text-h1">Tạo truyện mới</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Thiết lập thông tin nhận diện, tóm tắt và phân loại độc giả cho cộng đồng NovelHub.
          </p>
          <nav aria-label="Các bước tạo truyện" className="mt-5">
            <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {steps.map(([, label], index) => {
                const number = index + 1
                const active = step === number
                const locked = number > completedStep + 1
                return (
                  <li key={label} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => goTo(number)}
                      disabled={locked || saving || Boolean(createdId)}
                      aria-current={active ? 'step' : undefined}
                      aria-disabled={locked ? 'true' : undefined}
                      className={`flex w-full min-w-0 items-center gap-2 whitespace-normal rounded-full border px-2 py-1.5 pr-4 text-left text-xs font-semibold transition-[background-color,border-color,color] duration-200 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm ${active ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-ink/70 hover:border-brand hover:text-ink'}`}
                    >
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full text-xs tabular-nums ${active ? 'bg-on-brand text-brand-strong' : 'bg-ink/6'}`}
                      >
                        {number}
                      </span>
                      <span className="min-w-0 leading-tight">{label}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
        </header>

        <div className="nh-grid-12 mt-6 grid items-start gap-6 nh-layout-xl-8-4">
          <form noValidate onSubmit={submit} className="min-w-0 space-y-6">
            <fieldset disabled={saving || Boolean(createdId)} className="min-w-0 space-y-6">
              <Card
                id={steps[0][0]}
                ref={node => (sectionRefs.current[0] = node)}
                hidden={step !== 1}
                className="scroll-mt-[calc(var(--app-header-h)+1rem)]"
              >
                <CardHeading
                  icon={BookOpen}
                  title="Tiêu đề và tổng quan bản thảo"
                  note="Trường có dấu * là bắt buộc"
                />
                <div className="mt-5 space-y-5">
                  <Field
                    id="story-title"
                    label="Tên truyện *"
                    count={`${title.length}/200`}
                    error={showErrors && errors.title}
                  >
                    <Input
                      id="story-title"
                      value={title}
                      maxLength={200}
                      required
                      aria-invalid={Boolean(showErrors && errors.title)}
                      aria-describedby={
                        showErrors && errors.title ? 'story-title-error' : undefined
                      }
                      onChange={event => {
                        setTitle(event.target.value)
                        touch(1)
                      }}
                    />
                  </Field>
                  <Field
                    id="story-synopsis"
                    label="Tóm tắt truyện *"
                    count={`${synopsis.length}/10000`}
                    error={showErrors && errors.synopsis}
                  >
                    <div className="overflow-hidden rounded-3xl border border-line bg-surface transition-colors focus-within:border-brand">
                      <textarea
                        id="story-synopsis"
                        value={synopsis}
                        maxLength={10000}
                        required
                        aria-invalid={Boolean(showErrors && errors.synopsis)}
                        aria-describedby={
                          showErrors && errors.synopsis ? 'story-synopsis-error' : undefined
                        }
                        onChange={event => {
                          setSynopsis(event.target.value)
                          touch(1)
                        }}
                        className="block min-h-40 w-full resize-y bg-transparent p-4 text-base leading-6 text-ink outline-none sm:text-sm"
                      />
                      <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-3 py-2">
                        <span className="text-xs text-muted">Có thể để trống khi lưu bản nháp</span>
                      </div>
                    </div>
                  </Field>
                </div>
              </Card>

              <Card
                id={steps[1][0]}
                ref={node => (sectionRefs.current[1] = node)}
                hidden={step !== 2}
                className="scroll-mt-[calc(var(--app-header-h)+1rem)]"
              >
                <CardHeading icon={ImagePlus} title="Bìa và hình ảnh" note="Không bắt buộc" />
                <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
                  <StoryCover
                    story={previewStory}
                    className="aspect-[2/3] w-28 shrink-0 rounded-2xl shadow-soft"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-muted">{t('createData.noCover')}</p>
                    <input
                      ref={fileRef}
                      id="story-cover"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={chooseCover}
                      className="sr-only"
                      aria-describedby={coverError ? 'story-cover-error' : undefined}
                    />
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        title={t('createData.noCover')}
                        onClick={() => fileRef.current?.click()}
                      >
                        <ImagePlus size={16} aria-hidden="true" />
                        {t(cover ? 'createData.replaceCover' : 'createData.uploadCover')}
                      </Button>
                      {cover && (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setCover(null)
                            touch(2)
                          }}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          {t('createData.removeCover')}
                        </Button>
                      )}
                    </div>
                    {cover && <p className="mt-2 truncate text-xs text-muted">{cover.name}</p>}
                    {coverError && (
                      <p
                        id="story-cover-error"
                        role="alert"
                        className="mt-2 text-xs text-rose-strong"
                      >
                        {coverError}
                      </p>
                    )}
                    <div className="mt-5 border-t border-hairline pt-5">
                      <p className="text-sm font-semibold">{t('createData.bannerTitle')}</p>
                      <div className="mt-3 aspect-[3/1] max-w-sm overflow-hidden rounded-xl border border-line bg-elevated">
                        {banner ? (
                          <img
                            src={banner.url}
                            alt={t('createData.bannerPreview')}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted">
                            {t('createData.noBanner')}
                          </div>
                        )}
                      </div>
                      <input
                        ref={bannerFileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={chooseBanner}
                        className="sr-only"
                        aria-describedby={bannerError ? 'story-banner-error' : undefined}
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => bannerFileRef.current?.click()}
                        >
                          <ImagePlus size={16} aria-hidden="true" />
                          {t(banner ? 'createData.changeBanner' : 'createData.uploadBanner')}
                        </Button>
                        {banner && (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setBanner(null)
                              touch(2)
                            }}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            {t('createData.removeBanner')}
                          </Button>
                        )}
                      </div>
                      {bannerError && (
                        <p
                          id="story-banner-error"
                          role="alert"
                          className="mt-2 text-xs text-rose-strong"
                        >
                          {bannerError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              <Card
                id={steps[2][0]}
                ref={node => (sectionRefs.current[2] = node)}
                hidden={step !== 3}
                className="scroll-mt-[calc(var(--app-header-h)+1rem)]"
              >
                <CardHeading icon={Tags} title="Phân loại thể loại và thẻ khám phá" />
                <fieldset className="mt-5">
                  <legend className="text-sm font-semibold">Thể loại chính *</legend>
                  {genreOptions.status === 'loading' ? (
                    <div
                      aria-busy="true"
                      aria-label="Đang tải danh sách thể loại"
                      className="mt-3 flex flex-wrap gap-2"
                    >
                      {genreChipWidths.map((width, index) => (
                        <Skeleton key={index} className={`h-[2.375rem] ${width}`} />
                      ))}
                    </div>
                  ) : genreOptions.status === 'error' ? (
                    <div className="mt-3 rounded-3xl border border-line">
                      <EmptyState
                        tone="rose"
                        icon={AlertTriangle}
                        headingAs="h3"
                        title="Không tải được danh sách thể loại"
                        description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
                        action={<RetryButton onClick={genreOptions.retry} />}
                        className="py-8"
                      />
                    </div>
                  ) : genreOptions.status === 'empty' ? (
                    <div className="mt-3 rounded-3xl border border-line">
                      <EmptyState
                        icon={Tags}
                        headingAs="h3"
                        title="Chưa có thể loại để chọn"
                        description="Danh sách thể loại đang được cập nhật. Tải lại để lấy danh sách mới nhất; các phần khác của biểu mẫu vẫn được giữ nguyên."
                        action={
                          <Button variant="secondary" size="sm" onClick={genreOptions.retry}>
                            <RefreshCw size={14} aria-hidden="true" />
                            Tải lại danh sách
                          </Button>
                        }
                        className="py-8"
                      />
                    </div>
                  ) : (
                    <div
                      role="radiogroup"
                      aria-label="Thể loại chính"
                      className="nh-fade-enter mt-3 flex flex-wrap gap-2"
                    >
                      {genreOptions.data.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          role="radio"
                          aria-checked={genre === item.id}
                          onClick={() => {
                            setGenre(item.id)
                            touch(3)
                          }}
                          className={`min-h-9 rounded-full border px-4 py-2 text-sm transition-[background-color,border-color,color] duration-200 ${genre === item.id ? 'border-brand bg-brand font-semibold text-on-brand' : 'border-line bg-surface text-ink/75 hover:border-brand hover:text-ink'}`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {showErrors && errors.genre && (
                    <p role="alert" className="mt-2 text-xs text-rose-strong">
                      {errors.genre}
                    </p>
                  )}
                </fieldset>

                <div className="mt-6">
                  <StoryTagEditor
                    id="story-tag"
                    tags={tags}
                    onChange={next => {
                      setTags(next)
                      touch(3)
                    }}
                  />
                </div>
              </Card>

              <Card
                id={steps[3][0]}
                ref={node => (sectionRefs.current[3] = node)}
                hidden={step !== 4}
                className="scroll-mt-[calc(var(--app-header-h)+1rem)]"
              >
                <CardHeading icon={Copyright} title="Xuất bản và bản quyền" />
                <p className="mt-5 rounded-2xl bg-elevated p-4 text-sm leading-6 text-muted">
                  {t('createData.rightsHint')}
                </p>
              </Card>
            </fieldset>
            {requestError && (
              <p role="alert" className="text-sm text-rose-strong">
                {requestError}
              </p>
            )}
            {createdId ? (
              <Card
                role="status"
                className="flex flex-col gap-4 border-brand/40 bg-brand-soft sm:flex-row sm:items-center"
              >
                <CheckCircle2 size={28} aria-hidden="true" className="shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-h3">Đã tạo truyện “{title.trim()}”</h2>
                  <p className="mt-1 text-sm text-muted">{t('createData.createdHint')}</p>
                </div>
                <ButtonLink to={`/author/stories/${createdId}`} trailingIcon={ChevronRight}>
                  Quản lý truyện
                </ButtonLink>
              </Card>
            ) : (
              <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                <Button type="button" variant="secondary" onClick={saveDraft} disabled={saving}>
                  {draftState === 'saved' ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Save size={16} aria-hidden="true" />
                  )}
                  {draftState === 'saving'
                    ? 'Đang lưu...'
                    : draftState === 'saved'
                      ? 'Đã lưu bản nháp'
                      : 'Lưu làm bản nháp'}
                </Button>
                <ButtonLink to="/author" variant="ghost">
                  Hủy
                </ButtonLink>
                <div className="grid gap-2 sm:ml-auto sm:flex sm:flex-wrap">
                  {step < 4 && (
                    <Button
                      type="button"
                      variant="outline"
                      trailingIcon={ChevronRight}
                      onClick={completeStep}
                    >
                      Tiếp tục đến bước {step + 1}
                    </Button>
                  )}
                  {step === steps.length && (
                    <Button type="submit" disabled={saving}>
                      <Check size={16} aria-hidden="true" />
                      {submitState === 'submitting' ? 'Đang tạo truyện...' : 'Tạo truyện'}
                    </Button>
                  )}
                </div>
                {showErrors && currentStepErrors.some(Boolean) && (
                  <p role="alert" className="w-full text-xs text-rose-strong sm:text-right">
                    Còn {currentStepErrors.filter(Boolean).length} mục cần hoàn thiện trước khi
                    tạo truyện.
                  </p>
                )}
              </div>
            )}
          </form>

          <aside
            className="min-w-0 space-y-6 xl:sticky xl:top-24"
            aria-label="Xem trước và kiểm tra"
          >
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-h3">
                  <Eye size={18} aria-hidden="true" className="text-orange-strong" />
                  Xem trước trên ứng dụng
                </h2>
                <Badge>Thẻ bảng tin</Badge>
              </div>
              <div className="mt-4 overflow-hidden rounded-3xl border border-hairline">
                <StoryCover
                  story={previewStory}
                  className="aspect-[4/3] w-full"
                  badge={
                    <span className="absolute bottom-3 left-3 rounded-full bg-surface shadow-whisper">
                      <Badge tone="green">{genreLabel}</Badge>
                    </span>
                  }
                />
                <div className="p-4">
                  <p className="text-xs font-semibold">
                    {currentUser.name} · {t('createData.previewDraft')}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{synopsis}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tags.slice(0, 3).map(tag => (
                      <Badge key={tag}>#{tag}</Badge>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setPreviewOpen(true)}
                    className="mt-4 w-full"
                  >
                    <BookOpen size={16} aria-hidden="true" />
                    Đọc bản xem trước
                  </Button>
                </div>
              </div>
            </Card>
            <Card>
              <h2 className="text-h3">Danh sách kiểm tra dành cho tác giả</h2>
              <ul className="mt-4 space-y-4">
                {[
                  ['Có tên truyện', Boolean(title.trim()), 1],
                  ['Đã nhập tóm tắt', Boolean(synopsis.trim()), 1],
                  [t('createData.coverOptional'), true, 2],
                ].map(([label, done, target]) => (
                  <li key={label} className="flex gap-3">
                    <span
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${done ? 'border-brand bg-brand text-on-brand' : 'border-line'}`}
                    >
                      {done && <Check size={12} aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <strong className="text-sm">{label}</strong>
                      <p className="text-xs text-muted">
                        {done ? (
                          'Đã đáp ứng yêu cầu'
                        ) : (
                          <button
                            type="button"
                            onClick={() => goTo(target)}
                            className="-my-3 py-3 text-brand-strong underline-offset-2 hover:underline"
                          >
                            Hoàn thiện ở bước {target}
                          </button>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-2xl bg-purple/10 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-purple-strong">
                  <Lightbulb size={14} aria-hidden="true" />
                  Mẹo hữu ích
                </p>
                <p className="mt-1.5 text-xs leading-5 text-ink/70">{t('createData.tip')}</p>
              </div>
            </Card>
          </aside>
        </div>

        <Modal
          open={previewOpen}
          title="Bản xem trước cho độc giả"
          onClose={() => setPreviewOpen(false)}
          className="max-w-2xl"
        >
          <div className="flex flex-col gap-5 sm:flex-row">
            <StoryCover story={previewStory} className="aspect-[2/3] w-32 shrink-0 rounded-2xl" />
            <div className="min-w-0">
              <Badge tone="green">{genreLabel}</Badge>
              <h3 className="mt-2 text-h2">{previewStory.title}</h3>
              <p className="text-sm text-muted">{currentUser.name}</p>
              <p className="mt-3 text-sm leading-6 text-muted">{synopsis}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <Badge key={tag}>#{tag}</Badge>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </AuthorLayout>
  )
}

/* Card heading: the shared SectionHeader with the section's icon tile, ruled off from the fields. */
function CardHeading({ icon: Icon, title, note }) {
  return (
    <div className="border-b border-hairline pb-4">
      <SectionHeader
        title={
          <span className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand-strong">
              <Icon size={18} />
            </span>
            {title}
          </span>
        }
        description={note}
      />
    </div>
  )
}

function Field({ id, label, count, error, children }) {
  return (
    <div>
      <div className="mb-2 flex justify-between gap-3 text-sm font-semibold">
        <label htmlFor={id}>{label}</label>
        {count && <span className="font-normal text-muted tabular-nums">{count}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-xs text-rose-strong">
          {error}
        </p>
      )}
    </div>
  )
}

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  )
}
