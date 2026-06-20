/**
 * Comprime uma imagem no navegador antes de enviá-la para o servidor.
 * Redimensiona mantendo a proporção para uma largura/altura máxima de 1280px
 * e exporta em formato JPEG com qualidade de 80%.
 * 
 * @param file O arquivo de imagem original selecionado pelo usuário
 * @param maxWidth Largura máxima permitida (padrão: 1280)
 * @param maxHeight Altura máxima permitida (padrão: 1280)
 * @param quality Qualidade do JPEG de 0 a 1 (padrão: 0.8)
 */
export function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Verificar se o arquivo é realmente uma imagem
    if (!file.type.startsWith('image/')) {
      return reject(new Error('O arquivo selecionado não é uma imagem válida.'));
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcular novas dimensões mantendo o aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        // Criar o canvas para redimensionar a imagem
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Não foi possível obter o contexto 2D do Canvas.'));
        }

        // Desenhar a imagem redimensionada no canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Exportar a imagem compactada como Blob JPEG
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Erro ao converter o Canvas em Blob de imagem.'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Erro ao carregar a imagem para processamento.'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler o arquivo de imagem.'));
    };
  });
}
