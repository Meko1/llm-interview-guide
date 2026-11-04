export function calculateLoraBudget(inputWidth: number, outputWidth: number, rank: number, alpha: number) {
  const baseParameters = inputWidth * outputWidth
  const adapterParameters = rank * (inputWidth + outputWidth)
  return {
    baseParameters,
    adapterParameters,
    fractionPercent: adapterParameters / baseParameters * 100,
    adapterMiB: adapterParameters * 2 / 2 ** 20,
    scale: alpha / rank
  }
}

export function calculateDpoPair(margin: number, beta: number) {
  const referenceChosen = -2.5
  const referenceRejected = -1.5
  const policyChosen = referenceChosen + margin / 2
  const policyRejected = referenceRejected - margin / 2
  const chosenGain = policyChosen - referenceChosen
  const rejectedGain = policyRejected - referenceRejected
  const logit = beta * (chosenGain - rejectedGain)
  const loss = Math.max(0, -logit) + Math.log1p(Math.exp(-Math.abs(logit)))
  return { referenceChosen, referenceRejected, policyChosen, policyRejected, chosenGain, rejectedGain, logit, loss }
}
