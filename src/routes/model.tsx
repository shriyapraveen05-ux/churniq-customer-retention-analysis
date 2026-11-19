import { createFileRoute } from '@tanstack/react-router'
import { ModelPage } from '@/components/pages/model'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/model')({
  head: () => pageHead('Churn Model', 'Logistic regression churn model: hold-out metrics, confusion matrix, ROC curve, cross-validation and feature effects.'),
  component: ModelPage,
})
