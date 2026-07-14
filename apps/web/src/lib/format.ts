export const todayLabel = () => new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
export const firstName = (name: string) => name.split(' ')[0] ?? name;
