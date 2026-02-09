const formatDate = (dateString) => {
    try {
        const date = new Date(dateString)
        const now = new Date()
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        })
    } catch (e) {
        console.log('Crashed on input:', dateString, 'Error:', e.message)
        return 'CRASHED'
    }
}

console.log("Testing valid date:", formatDate("2023-01-01"))
console.log("Testing undefined:", formatDate(undefined))
console.log("Testing null:", formatDate(null))
console.log("Testing invalid string:", formatDate("not-a-date"))
