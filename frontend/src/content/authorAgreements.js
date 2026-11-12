export const authorAgreements = ['authorGuidelines', 'publishing', 'rights', 'revenue'].map(
  type => ({
    type,
    title: 'legal.author.' + type + '.title',
    introduction: 'legal.author.' + type + '.intro',
    sections: [1, 2, 3].map(index => [
      'legal.author.' + type + '.section' + index + 'Title',
      'legal.author.' + type + '.section' + index + 'Body',
    ]),
  }),
)
