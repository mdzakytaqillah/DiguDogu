export function formatPostDate(dateString: string): string {
  const uploadDate = new Date(dateString);
  const now = new Date();

  const uploadDay = new Date(
    uploadDate.getFullYear(),
    uploadDate.getMonth(),
    uploadDate.getDate(),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  const dateOptionsNoYear: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  };
  const dateOptionsWithYear: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };

  if (uploadDay.getTime() === today.getTime()) {
    // Hari ini: Tampilkan jam saja (misal: 14:30)
    return uploadDate.toLocaleTimeString("id-ID", timeOptions);
  } else if (uploadDate.getFullYear() === now.getFullYear()) {
    // Tahun ini: Tampilkan tanggal dan jam (misal: 15 Aug 14:30)
    return `${uploadDate.toLocaleDateString("id-ID", dateOptionsNoYear)} ${uploadDate.toLocaleTimeString("id-ID", timeOptions)}`;
  } else {
    // Tahun lalu atau lebih lama: Tampilkan tahun, tanggal, dan jam
    return `${uploadDate.toLocaleDateString("id-ID", dateOptionsWithYear)} ${uploadDate.toLocaleTimeString("id-ID", timeOptions)}`;
  }
}
