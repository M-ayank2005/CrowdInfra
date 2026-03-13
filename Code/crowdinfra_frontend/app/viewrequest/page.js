'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import axios from 'axios'
import Navbar from '../components/navbar'
import Footer from '../components/footer'
import Loading from '../components/loading'
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from '../lib/google-maps-config'

export default function ViewRequest() {
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [businessAnalysis, setBusinessAnalysis] = useState(null)
  const [businessLoading, setBusinessLoading] = useState(false)
  const [requestId, setRequestId] = useState('')
  const [isRequestIdReady, setIsRequestIdReady] = useState(false)
  const mapRef = useRef(null)
  const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim() || ''
  const GEMINI_TEXT_MODELS = [
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
  ]
  const BUSINESS_ANALYSIS_CACHE_VERSION = 'v3'

  const GEMINI_RATE_LIMIT_KEY = 'crowdinfra:gemini-rate-limit-until'
  const getAnalysisCacheKey = (id) =>
    `crowdinfra:business-analysis:${BUSINESS_ANALYSIS_CACHE_VERSION}:${id}`

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const readCachedBusinessAnalysis = (id) => {
    if (typeof window === 'undefined' || !id) return null
    try {
      const raw = window.localStorage.getItem(getAnalysisCacheKey(id))
      return raw ? JSON.parse(raw) : null
    } catch (_) {
      return null
    }
  }

  const writeCachedBusinessAnalysis = (id, value) => {
    if (typeof window === 'undefined' || !id || !value) return
    try {
      window.localStorage.setItem(getAnalysisCacheKey(id), JSON.stringify(value))
    } catch (_) {
      // Ignore storage errors (private mode / quota / etc).
    }
  }

  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const id = new URLSearchParams(window.location.search).get('id')?.trim() || ''
    setRequestId(id)
    setIsRequestIdReady(true)
  }, [])

  useEffect(() => {
    if (!isRequestIdReady) {
      return
    }

    if (!requestId) {
      setLoading(false)
      setError('Request ID not found in URL')
      return
    }

    let active = true

    async function fetchRequest() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/demand/getDemandById/${requestId}`,
          { cache: 'no-store' }
        )
        if (!response.ok) {
          throw new Error('Failed to fetch request details')
        }
        const data = await response.json()

        if (!active) {
          return
        }

        setRequest(data)

        if (data) {
          const cachedAnalysis = readCachedBusinessAnalysis(data._id)
          if (cachedAnalysis) {
            setBusinessAnalysis(cachedAnalysis)
          } else {
            setBusinessAnalysis(null)
            void getBusinessSuggestions(data)
          }
        }
      } catch (err) {
        console.error('Error fetching request:', err)
        if (active) {
          setError(err.message)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchRequest()

    return () => {
      active = false
    }
  }, [requestId, isRequestIdReady])

  useEffect(() => {
    if (request && mapRef.current) {
      initMap()
    }
  }, [request])

  const parseGeminiJson = (rawText) => {
    if (!rawText || typeof rawText !== 'string') return null

    const trimmed = rawText.trim()

    try {
      return JSON.parse(trimmed)
    } catch (_) {
      // Continue with additional fallbacks.
    }

    const withoutFence = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim()

    try {
      return JSON.parse(withoutFence)
    } catch (_) {
      // Continue with object extraction fallback.
    }

    const jsonMatch = withoutFence.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    try {
      return JSON.parse(jsonMatch[0])
    } catch (_) {
      return null
    }
  }

  const clampScore = (value) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return null
    return Math.min(100, Math.max(0, Math.round(numeric)))
  }

  const normalizeHundredScore = (value) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return null
    if (numeric >= 0 && numeric <= 10) {
      return clampScore(numeric * 10)
    }
    return clampScore(numeric)
  }

  const toSafeText = (value) =>
    typeof value === 'string' ? value.trim() : ''

  const pickFirstValue = (raw, keys) => {
    for (const key of keys) {
      const value = raw?.[key]
      if (value !== undefined && value !== null && value !== '') {
        return value
      }
    }
    return null
  }

  const competitionLevelToScore = (value) => {
    const normalized = toSafeText(value)
      .toLowerCase()
      .replace(/\s+/g, '-')

    const map = {
      'very-low': 15,
      low: 30,
      'medium-low': 45,
      medium: 55,
      'medium-high': 70,
      high: 80,
      'very-high': 92,
    }

    return map[normalized] ?? null
  }

  const normalizeActionList = (value) => {
    if (Array.isArray(value)) {
      return normalizeStringList(value, 1)
    }

    if (typeof value === 'string' && value.trim()) {
      const pieces = value
        .split(/\n|\.|;|\u2022|\-/)
        .map((item) => item.trim())
        .filter((item) => item.length > 4)

      if (pieces.length > 0) {
        return pieces.slice(0, 7)
      }

      return [value.trim()]
    }

    return []
  }

  const normalizeStringList = (value, minItems = 0) => {
    if (!Array.isArray(value)) return []
    const cleaned = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
    if (cleaned.length < minItems) return []
    return cleaned
  }

  const normalizeBusinessAnalysis = (raw, sources = []) => {
    if (!raw || typeof raw !== 'object') return null

    const successProbability = normalizeHundredScore(
      pickFirstValue(raw, [
        'successProbability',
        'estimated_success_probability',
        'success_probability',
      ])
    )

    const marketPotentialScore = normalizeHundredScore(
      pickFirstValue(raw, [
        'marketPotentialScore',
        'estimated_market_impact_score',
        'market_impact_score',
      ])
    )

    const competitionIntensity =
      normalizeHundredScore(
        pickFirstValue(raw, [
          'competitionIntensity',
          'estimated_competition_score',
          'competition_score',
        ])
      ) ||
      competitionLevelToScore(
        pickFirstValue(raw, [
          'estimated_competition_level',
          'competition_level',
          'competitionLevel',
        ])
      )

    const confidenceScore = normalizeHundredScore(
      pickFirstValue(raw, [
        'confidenceScore',
        'confidence_score',
        'analysis_confidence',
      ])
    )

    const summary =
      toSafeText(
        pickFirstValue(raw, ['summary', 'overall_summary', 'executive_summary'])
      ) ||
      toSafeText(
        pickFirstValue(raw, ['success_rationale', 'recommended_next_steps'])
      )

    const competitiveAnalysis = toSafeText(
      pickFirstValue(raw, [
        'competitiveAnalysis',
        'competitive_analysis',
        'competition_rationale',
      ])
    )

    const marketPotential = toSafeText(
      pickFirstValue(raw, [
        'marketPotential',
        'market_potential',
        'market_impact_rationale',
      ])
    )

    const resourceRequirements =
      toSafeText(
        pickFirstValue(raw, [
          'resourceRequirements',
          'resource_requirements',
          'resource_intensity_rationale',
        ])
      ) ||
      toSafeText(
        pickFirstValue(raw, [
          'estimated_resource_intensity',
          'resource_intensity_level',
        ])
      )

    const successFactors =
      toSafeText(
        pickFirstValue(raw, ['successFactors', 'success_factors'])
      ) || toSafeText(pickFirstValue(raw, ['success_rationale']))

    const riskFactors =
      toSafeText(pickFirstValue(raw, ['riskFactors', 'risk_factors'])) ||
      toSafeText(
        pickFirstValue(raw, ['competition_rationale', 'resource_intensity_rationale'])
      )

    const recommendedActions = normalizeActionList(
      pickFirstValue(raw, [
        'recommendedActions',
        'recommended_actions',
        'recommended_next_steps',
      ])
    )

    const assumptions = normalizeActionList(
      pickFirstValue(raw, ['assumptions', 'key_assumptions'])
    )

    return {
      successProbability,
      marketPotentialScore,
      competitionIntensity,
      confidenceScore,
      summary,
      competitiveAnalysis,
      marketPotential,
      resourceRequirements,
      successFactors,
      riskFactors,
      recommendedActions,
      assumptions,
      sources,
    }
  }

  const hasMeaningfulBusinessAnalysis = (analysis) => {
    if (!analysis || typeof analysis !== 'object') return false

    const hasAnyScore = [
      analysis.successProbability,
      analysis.marketPotentialScore,
      analysis.competitionIntensity,
      analysis.confidenceScore,
    ].some((value) => value !== null && value !== undefined)

    const hasAnyNarrative = [
      analysis.summary,
      analysis.competitiveAnalysis,
      analysis.marketPotential,
      analysis.resourceRequirements,
      analysis.successFactors,
      analysis.riskFactors,
    ].some((value) => typeof value === 'string' && value.trim().length > 0)

    const hasAnyListItems =
      (Array.isArray(analysis.recommendedActions) &&
        analysis.recommendedActions.length > 0) ||
      (Array.isArray(analysis.assumptions) && analysis.assumptions.length > 0)

    return hasAnyScore || hasAnyNarrative || hasAnyListItems
  }

  function initMap() {
    if (typeof window === 'undefined' || !GOOGLE_MAPS_API_KEY) {
      return
    }

    if (window.google?.maps) {
      renderMap()
      return
    }

    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID)
    if (existingScript) {
      existingScript.addEventListener('load', renderMap, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = GOOGLE_MAPS_SCRIPT_ID
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=${GOOGLE_MAPS_LIBRARIES.join(',')}`
    script.async = true
    script.defer = true
    script.onload = () => renderMap()
    document.head.appendChild(script)
  }

  function renderMap() {
    try {
      if (!mapRef.current || !window.google || !window.google.maps) {
        console.error('Google Maps API not loaded yet')
        return
      }
      const mapOptions = {
        center: {
          lat: request.location.coordinates[1],
          lng: request.location.coordinates[0],
        },
        zoom: 15,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
          {
            elementType: 'labels.text.stroke',
            stylers: [{ color: '#242f3e' }],
          },
          { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
        ],
      }
      const map = new window.google.maps.Map(mapRef.current, mapOptions)
      const marker = new window.google.maps.Marker({
        position: {
          lat: request.location.coordinates[1],
          lng: request.location.coordinates[0],
        },
        map: map,
        title: request.title,
        animation: window.google.maps.Animation.DROP,
      })
    } catch (error) {
      console.error('Error rendering map:', error)
    }
  }

  const handleUpvote = async () => {
    try {
      const response = await axios.patch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/demand/${request._id}/upvote`,
        {},
        { withCredentials: true }
      )
      const updatedRequest = response.data.data
      setRequest(updatedRequest)
    } catch (err) {
      console.error('Error upvoting demand:', err)
    }
  }

  async function getBusinessSuggestions(requestData) {
    if (!requestData?._id) {
      setBusinessAnalysis({
        error: 'Cannot generate suggestions for an invalid request payload.',
      })
      return
    }

    if (!geminiApiKey) {
      setBusinessAnalysis({
        error:
          'Gemini API key is missing. Set NEXT_PUBLIC_GEMINI_API_KEY in frontend env.',
      })
      return
    }

    if (typeof window !== 'undefined') {
      const limitedUntil = Number(
        window.localStorage.getItem(GEMINI_RATE_LIMIT_KEY) || 0
      )
      if (limitedUntil > Date.now()) {
        const secondsLeft = Math.max(
          1,
          Math.ceil((limitedUntil - Date.now()) / 1000)
        )
        setBusinessAnalysis({
          error: `Gemini is rate limited right now. Please retry in about ${secondsLeft}s.`,
        })
        return
      }
    }

    setBusinessLoading(true)

    try {
      const demandLat = requestData.location?.coordinates?.[1]
      const demandLng = requestData.location?.coordinates?.[0]
      const commentsCount = Array.isArray(requestData.comments)
        ? requestData.comments.length
        : 0
      const demandAgeDays = Number.isFinite(new Date(requestData.createdAt).getTime())
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(requestData.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : null

      const analysisSchema = {
        type: 'object',
        properties: {
          successProbability: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description:
              'Estimated chance of successful execution and outcome for this demand in this location.',
          },
          marketPotentialScore: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description:
              'Demand opportunity and adoption potential in this location.',
          },
          competitionIntensity: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description:
              'Competition saturation where 0 is very low competition and 100 is very high competition.',
          },
          confidenceScore: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description:
              'Confidence in the analysis considering available evidence and assumptions.',
          },
          summary: { type: 'string' },
          competitiveAnalysis: { type: 'string' },
          marketPotential: { type: 'string' },
          resourceRequirements: { type: 'string' },
          successFactors: { type: 'string' },
          riskFactors: { type: 'string' },
          recommendedActions: {
            type: 'array',
            items: { type: 'string' },
            minItems: 3,
            maxItems: 7,
          },
          assumptions: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2,
            maxItems: 6,
          },
        },
        required: [
          'successProbability',
          'marketPotentialScore',
          'competitionIntensity',
          'confidenceScore',
          'summary',
          'competitiveAnalysis',
          'marketPotential',
          'resourceRequirements',
          'successFactors',
          'riskFactors',
          'recommendedActions',
          'assumptions',
        ],
        additionalProperties: false,
      }

      const prompt = `
You are a market-intelligence analyst for public demand execution.

Use these inputs:
- Title: ${requestData.title}
- Category: ${requestData.category}
- Description: ${requestData.description}
- Location coordinates: ${demandLat}, ${demandLng}
- Upvotes: ${requestData.up_votes || 0}
- Downvotes: ${requestData.down_votes || 0}
- Comments count: ${commentsCount}
- Demand age (days): ${demandAgeDays ?? 'unknown'}

Task requirements:
1. Estimate realistic success and market metrics for this specific demand and location.
2. Prefer current local context and competition signals when available.
3. Avoid generic statements. Provide concrete rationale tied to this demand.
4. Output only valid JSON matching the requested schema.
5. Keep each narrative field concise (2-5 sentences), practical, and decision-oriented.
`

      const buildRequestBody = (variant) => {
        const base = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }

        if (variant === 'groundedStructured') {
          return {
            ...base,
            tools: [{ googleSearch: {} }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: analysisSchema,
              temperature: 0.15,
              topP: 0.9,
            },
          }
        }

        if (variant === 'structuredOnly') {
          return {
            ...base,
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: analysisSchema,
              temperature: 0.15,
              topP: 0.9,
            },
          }
        }

        return {
          ...base,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }
      }

      const requestVariants = ['groundedStructured', 'structuredOnly', 'jsonOnly']

      const callModelWithRetries = async (modelName, variant) => {
        let lastAttemptError = null
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            return await axios({
              url: `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
              method: 'post',
              headers: { 'Content-Type': 'application/json' },
              data: buildRequestBody(variant),
            })
          } catch (err) {
            lastAttemptError = err
            const status = err?.response?.status
            const retryAfterHeader = Number(
              err?.response?.headers?.['retry-after']
            )

            if (status === 429 && attempt < 2) {
              const waitMs =
                Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
                  ? retryAfterHeader * 1000
                  : (attempt + 1) * 2000
              await wait(waitMs)
              continue
            }

            throw err
          }
        }

        throw lastAttemptError
      }

      let response = null
      let lastError = null
      const compatibilityErrors = []

      for (const modelName of GEMINI_TEXT_MODELS) {
        let modelUnavailable = false

        for (const variant of requestVariants) {
          try {
            response = await callModelWithRetries(modelName, variant)
            break
          } catch (err) {
            lastError = err
            const status = err?.response?.status
            const message = (
              err?.response?.data?.error?.message ||
              err?.message ||
              ''
            ).toLowerCase()

            const isModelCompatibilityError =
              (status === 400 || status === 404) &&
              (message.includes('model') ||
                message.includes('not found') ||
                message.includes('not available') ||
                message.includes('unsupported'))

            if (isModelCompatibilityError) {
              compatibilityErrors.push(modelName)
              modelUnavailable = true
              break
            }

            const isConfigCompatibilityError =
              status === 400 &&
              (message.includes('googlesearch') ||
                message.includes('google_search') ||
                message.includes('tool') ||
                message.includes('responseschema') ||
                message.includes('response_schema') ||
                message.includes('schema'))

            if (isConfigCompatibilityError) {
              continue
            }

            throw err
          }
        }

        if (response) {
          break
        }

        if (modelUnavailable) {
          continue
        }
      }

      if (!response && compatibilityErrors.length === GEMINI_TEXT_MODELS.length) {
        setBusinessAnalysis({
          error:
            'No compatible Gemini text model is currently available for this key/project/region. Please verify model access in Google AI Studio.',
          text: `Tried models: ${GEMINI_TEXT_MODELS.join(', ')}`,
        })
        return
      }

      if (!response && lastError) {
        throw lastError
      }

      const groundingSources =
        response.data?.candidates?.[0]?.groundingMetadata?.groundingChunks
          ?.map((chunk) => chunk?.web)
          ?.filter((web) => web?.uri && web?.title)
          ?.map((web) => ({ title: web.title, uri: web.uri })) || []

      const responseText =
        response.data?.candidates?.[0]?.content?.parts?.find(
          (part) => typeof part?.text === 'string'
        )?.text || ''

      const parsedData = parseGeminiJson(responseText)

      if (parsedData) {
        const normalizedAnalysis = normalizeBusinessAnalysis(
          parsedData,
          groundingSources
        )

        if (!normalizedAnalysis) {
          setBusinessAnalysis({
            error: 'Gemini returned data but it could not be normalized.',
            text: responseText,
          })
          return
        }

        if (!hasMeaningfulBusinessAnalysis(normalizedAnalysis)) {
          setBusinessAnalysis({
            error:
              'Gemini returned an empty analysis payload. Please click Regenerate to retry.',
            text:
              responseText ||
              JSON.stringify(response.data?.promptFeedback || {}, null, 2),
          })
          return
        }

        setBusinessAnalysis(normalizedAnalysis)
        writeCachedBusinessAnalysis(requestData._id, normalizedAnalysis)
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(GEMINI_RATE_LIMIT_KEY)
        }
      } else {
        setBusinessAnalysis({
          error: 'Gemini returned an unexpected response format.',
          text:
            responseText ||
            JSON.stringify(response.data?.promptFeedback || {}, null, 2),
        })
      }

      if (!response.data?.candidates?.length) {
        setBusinessAnalysis({
          error:
            response.data?.promptFeedback?.blockReason ||
            'Gemini did not return any suggestions for this request.',
        })
      }
    } catch (err) {
      console.error('Error getting business analysis:', err)
      const apiMessage = err?.response?.data?.error?.message
      const status = err?.response?.status

      if (status === 429 && typeof window !== 'undefined') {
        const retryAfterHeader = Number(err?.response?.headers?.['retry-after'])
        const cooldownMs =
          Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
            ? retryAfterHeader * 1000
            : 60000
        window.localStorage.setItem(
          GEMINI_RATE_LIMIT_KEY,
          String(Date.now() + cooldownMs)
        )

        setBusinessAnalysis({
          error:
            'Gemini request limit reached. Please wait about a minute and press Regenerate.',
        })
        return
      }

      setBusinessAnalysis({
        error:
          apiMessage ||
          'Failed to generate business analysis. Please try again later.',
      })
    } finally {
      setBusinessLoading(false)
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading)
    return (
      <div className='min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100'>
        <Navbar />
        <div className='pt-28 px-6'>
          <Loading
            text='Loading demand details...'
            size='md'
            className='min-h-[60vh] bg-transparent'
          />
        </div>
      </div>
    )

  if (error)
    return (
      <div className='min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100'>
        <Navbar />
        <div className='pt-28 px-6'>
          <div className='mx-auto max-w-3xl rounded-xl border border-red-700/40 bg-red-950/20 p-8 shadow-2xl'>
            <h2 className='text-3xl font-bold text-red-300 mb-4'>Could not load request</h2>
            <p className='text-red-100/90 text-lg'>{error}</p>
            <Link
              href='/search-demands'
              className='mt-6 inline-block rounded-lg bg-red-600/80 px-4 py-2 text-white hover:bg-red-500 transition-colors'
            >
              Back to Search Demands
            </Link>
          </div>
        </div>
      </div>
    )

  return (
    <div className='min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black w-full text-slate-100'>
      <Navbar />
      <div className='pt-24'>
      {/* Header Banner */}
      <div className='w-full py-12 px-8 sm:px-12'>
        <div className='max-w-7xl mx-auto text-center'>
          <h1 className='text-5xl font-extrabold text-white mb-4 drop-shadow-2xl'>
            {request.title}
          </h1>
          <div className='flex flex-wrap justify-center gap-4 mb-6'>
            <span className='inline-flex items-center px-5 py-2 rounded-full text-lg font-semibold bg-indigo-200 text-indigo-900 shadow-md'>
              {request.category}
            </span>
            <span className='inline-flex items-center px-5 py-2 rounded-full text-lg font-semibold bg-yellow-200 text-yellow-800 shadow-md'>
              {request.status.replace('_', ' ')}
            </span>
            <span className='inline-flex items-center px-5 py-2 rounded-full text-lg font-semibold bg-green-200 text-green-800 shadow-md'>
              Created: {formatDate(request.createdAt)}
            </span>
          </div>
          <div className='flex flex-wrap justify-center gap-6'>
            <button
              onClick={() => handleUpvote()}
              className='inline-flex items-center px-8 py-4 bg-green-500 hover:bg-green-600 rounded-full text-white font-bold transition-transform transform hover:scale-105 shadow-2xl'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-6 w-6 mr-3'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9'
                />
              </svg>
              Upvote ({request.up_votes})
            </button>
            <div className='relative'>
              <button
                className='inline-flex items-center px-8 py-4 bg-indigo-500 hover:bg-indigo-600 rounded-full text-white font-bold transition-transform transform hover:scale-105 shadow-2xl'
                onClick={() => {
                  const dropdown = document.getElementById('share-dropdown')
                  dropdown.classList.toggle('hidden')
                }}
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='h-6 w-6 mr-3'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316'
                  />
                </svg>
                Share
              </button>
              <div
                id='share-dropdown'
                className='hidden absolute top-full right-0 mt-3 w-60 rounded-md shadow-2xl bg-gray-900 border border-indigo-700 z-20'
              >
                <div className='py-2'>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentUrl)
                      alert('Link copied to clipboard!')
                      document
                        .getElementById('share-dropdown')
                        .classList.add('hidden')
                    }}
                    className='flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors'
                  >
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='h-5 w-5 mr-3 text-gray-400'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1'
                      />
                    </svg>
                    Copy Link
                  </button>
                  <a
                    href={`https://twitter.com/intent/tweet?text=Check out this demand: ${
                      request.title
                    }&url=${encodeURIComponent(currentUrl)}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors'
                    onClick={() =>
                      document
                        .getElementById('share-dropdown')
                        .classList.add('hidden')
                    }
                  >
                    <svg
                      className='h-5 w-5 mr-3 text-blue-400'
                      fill='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path d='M23.953 4.57a10 10 0 01-2.825.775' />
                    </svg>
                    Share on Twitter
                  </a>
                  <a
                    href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(
                      currentUrl
                    )}&title=${encodeURIComponent(request.title)}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors'
                    onClick={() =>
                      document
                        .getElementById('share-dropdown')
                        .classList.add('hidden')
                    }
                  >
                    <svg
                      className='h-5 w-5 mr-3 text-blue-500'
                      fill='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path d='M20.447 20.452h-3.554v-5.569' />
                    </svg>
                    Share on LinkedIn
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      request.title
                    )}%0A%0A${encodeURIComponent(currentUrl)}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors'
                    onClick={() =>
                      document
                        .getElementById('share-dropdown')
                        .classList.add('hidden')
                    }
                  >
                    <svg
                      className='h-5 w-5 mr-3 text-green-400'
                      fill='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path d='M20.52 3.48A11.89 11.89 0 0012 0C5.373 0 0 5.373 0 12a11.89 11.89 0 001.64 6.01L0 24l5.99-1.64A11.89 11.89 0 0012 24c6.627 0 12-5.373 12-12a11.89 11.89 0 00-3.48-8.52zm-8.52 18a9.89 9.89 0 01-5.32-1.55l-.38-.23-3.55.97.97-3.55-.25-.41A9.89 9.89 0 012 12c0-5.51 4.49-10 10-10s10 4.49 10 10-4.49 10-10 10zm5.47-7.53c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.34.23-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.77-1.66-2.06-.17-.3 0-.45.13-.6.13-.15.3-.36.45-.55.15-.2.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.67-1.61-.92-2.21-.24-.59-.48-.5-.67-.51-.17-.01-.36-.01-.57-.01-.21 0-.53.07-.8.37-.28.3-1.05 1.01-1.05 2.48 0 1.47 1.07 2.88 1.22 3.08.15.21 2.1 3.21 5.08 4.5.71.3 1.26.48 1.68.62.72.23 1.36.2 1.87.15.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.28.17-1.42-.08-.15-.27-.23-.57-.38z' />
                    </svg>
                    Share on WhatsApp
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(
                      `Check out this demand: ${request.title}`
                    )}&body=${encodeURIComponent(
                      `I found this interesting demand on CrowdInfra:\n\n${request.title}\n${currentUrl}`
                    )}`}
                    className='flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors'
                    onClick={() =>
                      document
                        .getElementById('share-dropdown')
                        .classList.add('hidden')
                    }
                  >
                    <svg
                      className='h-5 w-5 mr-3 text-gray-400'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8'
                      />
                    </svg>
                    Share via Email
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Sections */}
          <div className='max-w-7xl mx-auto px-8 sm:px-12 py-10 space-y-12'>
            {/* Description Section */}
            <div className='bg-gray-900 rounded-2xl shadow-2xl overflow-hidden transform transition-all hover:scale-105'>
              <div className='p-8'>
                <h2 className='text-3xl font-bold text-indigo-300 mb-5 flex items-center'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    className='h-8 w-8 mr-3'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                    />
                  </svg>
                  Description
                </h2>
                <div className='bg-gray-800 rounded-lg p-8 border border-indigo-700'>
                  <p className='text-gray-100 text-lg'>{request.description}</p>
                </div>
              </div>
            </div>

            {/* Map & Location Section */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-12'>
              <div className='bg-gray-900 rounded-2xl shadow-2xl overflow-hidden transform transition-all hover:scale-105'>
                <div className='p-8'>
                  <h2 className='text-3xl font-bold text-indigo-300 mb-5 flex items-center'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='h-8 w-8 mr-3'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
                      />
                    </svg>
                    Location
                  </h2>
                  <div className='bg-gray-800 rounded-lg p-2 border border-indigo-700 shadow-inner'>
                    <div
                      ref={mapRef}
                      className='h-[350px] w-full rounded-lg overflow-hidden'
                    ></div>
                    <div className='p-4 bg-gray-800 border-t border-indigo-700'>
                      <p className='text-gray-300 text-lg flex items-center'>
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          className='h-6 w-6 mr-2 text-indigo-400'
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
                          />
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
                          />
                        </svg>
                        {request.location.coordinates[1]},{' '}
                        {request.location.coordinates[0]}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className='bg-gray-900 rounded-2xl shadow-2xl overflow-hidden transform transition-all hover:scale-105'>
                <div className='p-8'>
                  <h2 className='text-3xl font-bold text-indigo-300 mb-5 flex items-center'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='h-8 w-8 mr-3'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M13 10V3L4 14h7v7l9-11h-7z'
                      />
                    </svg>
                    Engagement Stats
                  </h2>
                  <div className='grid grid-cols-2 gap-8'>
                    <div className='bg-gray-800 rounded-xl p-8 border border-green-800 shadow-inner flex flex-col items-center justify-center'>
                      <div className='text-5xl font-extrabold text-green-300 mb-3'>
                        👍 {request.up_votes}
                      </div>
                      <div className='text-gray-200 text-xl'>Upvotes</div>
                    </div>
                    <div className='bg-gray-800 rounded-xl p-8 border border-red-800 shadow-inner flex flex-col items-center justify-center'>
                      <div className='text-5xl font-extrabold text-red-300 mb-3'>
                        👎 {request.down_votes}
                      </div>
                      <div className='text-gray-200 text-xl'>Downvotes</div>
                    </div>
                  </div>
                  <div className='mt-8 bg-gray-800 rounded-xl p-8 border border-blue-800 shadow-lg'>
                    <h3 className='text-2xl font-semibold text-blue-300 mb-3 flex items-center'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        className='h-6 w-6 mr-3'
                        fill='none'
                        viewBox='0 0 24 24'
                        stroke='currentColor'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                      Timeline
                    </h3>
                    <div className='space-y-3'>
                      <p className='text-gray-300 text-lg flex items-center'>
                        <span className='w-32 text-gray-500'>Created:</span>
                        <span className='font-semibold text-blue-300'>
                          {formatDate(request.createdAt)}
                        </span>
                      </p>
                      <p className='text-gray-300 text-lg flex items-center'>
                        <span className='w-32 text-gray-500'>Updated:</span>
                        <span className='font-semibold text-blue-300'>
                          {formatDate(request.updatedAt)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Gemini Business Analysis Section */}
            <div className='bg-gray-900 rounded-xl shadow-2xl overflow-hidden transform transition-all hover:scale-105'>
              <div className='bg-black px-10 py-8 flex items-center justify-between gap-4 flex-wrap'>
                <div className='flex items-center'>
                  <div className='bg-white/20 rounded-full p-3 mr-4'>
                    <svg
                      className='h-8 w-8 text-white'
                      viewBox='0 0 24 24'
                      fill='currentColor'
                    >
                      <path
                        d='M12 22.5c5.799 0 10.5-4.701 10.5-10.5S17.799 1.5 12 1.5 1.5 6.201 1.5 12s4.701 10.5 10.5 10.5Z'
                        fillOpacity='0.24'
                      />
                      <path d='M14.5 4.5h-4.8a.7.7 0 00-.7.7v3.8a.7.7 0 00.7.7h4.8a.7.7 0 00.7-.7v-3.8a.7.7 0 00-.7-.7ZM11 14.5H6.2a.7.7 0 00-.7.7v3.8a.7.7 0 00.7.7H11a.7.7 0 00.7-.7v-3.8a.7.7 0 00-.7-.7Z' />
                    </svg>
                  </div>
                  <h2 className='text-3xl font-bold text-white'>
                    Gemini AI Business Analysis
                  </h2>
                </div>
                <button
                  type='button'
                  disabled={businessLoading}
                  onClick={() => getBusinessSuggestions(request)}
                  className='rounded-lg border border-blue-400/40 bg-blue-500/20 px-4 py-2 text-sm font-semibold text-blue-200 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  Regenerate
                </button>
              </div>
              <div className='p-8'>
                {businessLoading ? (
                  <Loading
                    text='Generating comprehensive business analysis...'
                    size='md'
                    className='min-h-[240px] border border-slate-700/60 bg-transparent'
                  />
                ) : businessAnalysis ? (
                  <div className='space-y-8'>
                    {(businessAnalysis.successProbability !== null ||
                      businessAnalysis.marketPotentialScore !== null ||
                      businessAnalysis.competitionIntensity !== null ||
                      businessAnalysis.confidenceScore !== null) && (
                      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                        <div className='rounded-xl border border-emerald-500/30 bg-emerald-900/20 p-4'>
                          <p className='text-xs uppercase tracking-wide text-emerald-200/80'>
                            Success Probability
                          </p>
                          <p className='mt-2 text-3xl font-bold text-emerald-300'>
                            {businessAnalysis.successProbability ?? '--'}%
                          </p>
                        </div>
                        <div className='rounded-xl border border-blue-500/30 bg-blue-900/20 p-4'>
                          <p className='text-xs uppercase tracking-wide text-blue-200/80'>
                            Market Potential
                          </p>
                          <p className='mt-2 text-3xl font-bold text-blue-300'>
                            {businessAnalysis.marketPotentialScore ?? '--'}
                          </p>
                        </div>
                        <div className='rounded-xl border border-amber-500/30 bg-amber-900/20 p-4'>
                          <p className='text-xs uppercase tracking-wide text-amber-200/80'>
                            Competition Intensity
                          </p>
                          <p className='mt-2 text-3xl font-bold text-amber-300'>
                            {businessAnalysis.competitionIntensity ?? '--'}
                          </p>
                        </div>
                        <div className='rounded-xl border border-violet-500/30 bg-violet-900/20 p-4'>
                          <p className='text-xs uppercase tracking-wide text-violet-200/80'>
                            Confidence
                          </p>
                          <p className='mt-2 text-3xl font-bold text-violet-300'>
                            {businessAnalysis.confidenceScore ?? '--'}%
                          </p>
                        </div>
                      </div>
                    )}

                    {businessAnalysis.summary && (
                      <div className='bg-gray-800 p-8 rounded-xl border border-blue-800 shadow-2xl'>
                        <h3 className='text-3xl font-bold text-blue-300 mb-5 flex items-center'>
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            className='h-8 w-8 mr-3'
                            fill='none'
                            viewBox='0 0 24 24'
                            stroke='currentColor'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M13 10V3L4 14h7v7l9-11h-7z'
                            />
                          </svg>
                          Executive Summary
                        </h3>
                        <p className='text-gray-100 text-lg leading-relaxed'>
                          {businessAnalysis.summary}
                        </p>
                      </div>
                    )}
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                      {businessAnalysis.competitiveAnalysis && (
                        <div className='bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-lg hover:shadow-2xl transition-shadow'>
                          <div className='flex items-center mb-5'>
                            <div className='bg-indigo-700/50 p-3 rounded-lg mr-4'>
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                className='h-8 w-8 text-indigo-300'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth={2}
                                  d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10'
                                />
                              </svg>
                            </div>
                            <h3 className='text-2xl font-bold text-indigo-300'>
                              Competitive Analysis
                            </h3>
                          </div>
                          <p className='text-gray-300 text-lg leading-relaxed'>
                            {businessAnalysis.competitiveAnalysis}
                          </p>
                        </div>
                      )}
                      {businessAnalysis.marketPotential && (
                        <div className='bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-lg hover:shadow-2xl transition-shadow'>
                          <div className='flex items-center mb-5'>
                            <div className='bg-green-700/50 p-3 rounded-lg mr-4'>
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                className='h-8 w-8 text-green-300'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth={2}
                                  d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
                                />
                              </svg>
                            </div>
                            <h3 className='text-2xl font-bold text-green-300'>
                              Market Potential
                            </h3>
                          </div>
                          <p className='text-gray-300 text-lg leading-relaxed'>
                            {businessAnalysis.marketPotential}
                          </p>
                        </div>
                      )}
                      {businessAnalysis.resourceRequirements && (
                        <div className='bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-lg hover:shadow-2xl transition-shadow'>
                          <div className='flex items-center mb-5'>
                            <div className='bg-purple-700/50 p-3 rounded-lg mr-4'>
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                className='h-8 w-8 text-purple-300'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth={2}
                                  d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2'
                                />
                              </svg>
                            </div>
                            <h3 className='text-2xl font-bold text-purple-300'>
                              Resource Requirements
                            </h3>
                          </div>
                          <p className='text-gray-300 text-lg leading-relaxed'>
                            {businessAnalysis.resourceRequirements}
                          </p>
                        </div>
                      )}
                      {businessAnalysis.successFactors && (
                        <div className='bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-lg hover:shadow-2xl transition-shadow'>
                          <div className='flex items-center mb-5'>
                            <div className='bg-yellow-700/50 p-3 rounded-lg mr-4'>
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                className='h-8 w-8 text-yellow-300'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth={2}
                                  d='M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'
                                />
                              </svg>
                            </div>
                            <h3 className='text-2xl font-bold text-yellow-300'>
                              Success Factors
                            </h3>
                          </div>
                          <p className='text-gray-300 text-lg leading-relaxed'>
                            {businessAnalysis.successFactors}
                          </p>
                        </div>
                      )}
                    </div>

                    {businessAnalysis.riskFactors && (
                      <div className='bg-gray-800 p-8 rounded-xl border border-rose-800 shadow-2xl'>
                        <h3 className='text-2xl font-bold text-rose-300 mb-4'>
                          Risk Factors
                        </h3>
                        <p className='text-gray-200 text-lg leading-relaxed'>
                          {businessAnalysis.riskFactors}
                        </p>
                      </div>
                    )}

                    {Array.isArray(businessAnalysis.recommendedActions) &&
                      businessAnalysis.recommendedActions.length > 0 && (
                        <div className='bg-gray-800 p-8 rounded-xl border border-cyan-800 shadow-2xl'>
                          <h3 className='text-2xl font-bold text-cyan-300 mb-4'>
                            Recommended Actions
                          </h3>
                          <ul className='list-disc pl-6 space-y-2 text-gray-200'>
                            {businessAnalysis.recommendedActions.map(
                              (action, idx) => (
                                <li key={`${action}-${idx}`}>{action}</li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                    {Array.isArray(businessAnalysis.assumptions) &&
                      businessAnalysis.assumptions.length > 0 && (
                        <div className='bg-gray-800 p-8 rounded-xl border border-slate-700 shadow-2xl'>
                          <h3 className='text-2xl font-bold text-slate-200 mb-4'>
                            Assumptions
                          </h3>
                          <ul className='list-disc pl-6 space-y-2 text-gray-300'>
                            {businessAnalysis.assumptions.map((assumption, idx) => (
                              <li key={`${assumption}-${idx}`}>{assumption}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {Array.isArray(businessAnalysis.sources) &&
                      businessAnalysis.sources.length > 0 && (
                        <div className='bg-gray-800 p-8 rounded-xl border border-sky-800 shadow-2xl'>
                          <h3 className='text-2xl font-bold text-sky-300 mb-4'>
                            Grounding Sources
                          </h3>
                          <ul className='space-y-2 text-sm text-sky-200'>
                            {businessAnalysis.sources.map((source, idx) => (
                              <li key={`${source.uri}-${idx}`}>
                                <a
                                  href={source.uri}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='underline decoration-sky-400/70 underline-offset-2 hover:text-sky-100'
                                >
                                  {source.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {businessAnalysis.error && (
                      <div className='bg-red-900/30 border border-red-800 p-8 rounded-lg'>
                        <h3 className='text-2xl font-bold text-red-400 mb-4 flex items-center'>
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            className='h-8 w-8 mr-4'
                            fill='none'
                            viewBox='0 0 24 24'
                            stroke='currentColor'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                            />
                          </svg>
                          Error
                        </h3>
                        <p className='text-gray-300 text-lg'>
                          {businessAnalysis.error}
                        </p>
                        {businessAnalysis.text && (
                          <div className='mt-4 p-4 bg-gray-900 rounded-lg text-sm text-gray-400 overflow-auto max-h-60'>
                            <pre>{businessAnalysis.text}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className='flex flex-col items-center justify-center py-12 bg-gray-800/50 rounded-xl border border-gray-700'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='h-20 w-20 text-gray-600 mb-6'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={1}
                        d='M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                      />
                    </svg>
                    <p className='text-gray-400 text-xl italic'>
                      Analysis not available
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Navigation */}
            <div className='flex justify-center items-center mt-12'>
              <Link
                href='/search-demands'
                className='inline-flex items-center px-8 py-4 bg-blue-600 border border-transparent rounded-full font-bold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-shadow shadow-2xl'
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='h-6 w-6 mr-3'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M10 19l-7-7m0 0l7-7m-7 7h18'
                  />
                </svg>
                Back to all requests
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
      <Footer />
    </div>
  )
}
